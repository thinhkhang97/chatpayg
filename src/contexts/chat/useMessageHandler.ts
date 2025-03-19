
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AIModel, ChatSession, Message } from "./types";
import { User } from "@supabase/supabase-js";

export const useMessageHandler = (
  user: User | null,
  currentSession: ChatSession | null,
  currentModel: AIModel,
  setCurrentSession: (session: ChatSession | null) => void,
  setChatHistory: (updater: (prev: ChatSession[]) => ChatSession[]) => void,
  setIsProcessing: (isProcessing: boolean) => void
) => {
  const sendMessage = async (content: string) => {
    if (!currentSession || !content.trim() || !user) return;
    
    setIsProcessing(true);
    
    try {
      // Create user message
      const userMessageId = uuidv4();
      const userMessage: Message = {
        id: userMessageId,
        content,
        sender: "user",
        timestamp: new Date(),
        model: currentModel
      };
      
      // Insert user message in Supabase
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          id: userMessageId,
          session_id: currentSession.id,
          content,
          sender: "user",
          model: currentModel
        });

      if (userMsgError) {
        toast.error('Error sending message');
        console.error('Error inserting user message:', userMsgError);
        setIsProcessing(false);
        return;
      }
      
      // Update session with user message locally
      const updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, userMessage],
        updatedAt: new Date(),
        model: currentModel,
      };
      
      setCurrentSession(updatedSession);
      
      // Update session title if this is the first message
      const isFirstMessage = currentSession.messages.length === 0;
      const newTitle = isFirstMessage ? content.slice(0, 30) + "..." : currentSession.title;
      
      // Update the session title in Supabase if it's the first message
      if (isFirstMessage) {
        const { error: titleUpdateError } = await supabase
          .from('chat_sessions')
          .update({ title: newTitle })
          .eq('id', currentSession.id);
          
        if (titleUpdateError) {
          console.error('Error updating session title:', titleUpdateError);
        }
      }
      
      // Use Edge Function to stream AI response from Gemini
      try {
        // Prepare messages for the API (including context)
        const messagesForAPI = updatedSession.messages.map(msg => ({
          sender: msg.sender,
          content: msg.content,
          model: msg.model
        }));
        
        // Start the streaming response
        const response = await fetch(`${window.location.origin}/functions/v1/chat-with-gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesForAPI,
            user_id: user.id,
            session_id: currentSession.id
          })
        });
        
        // Create AI message that will be updated with streamed content
        const aiMessageId = uuidv4();
        let aiMessage: Message = {
          id: aiMessageId,
          content: "",
          sender: "ai",
          timestamp: new Date(),
          model: currentModel
        };
        
        // Update the session with the initial empty AI message
        const sessionWithAiMessage = {
          ...updatedSession,
          messages: [...updatedSession.messages, aiMessage]
        };
        
        setCurrentSession(sessionWithAiMessage);
        
        if (!response.ok || !response.body) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Set up the event stream reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // Process the streaming response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            const eventTypeMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);
            
            if (eventTypeMatch && dataMatch) {
              const eventType = eventTypeMatch[1].trim();
              const data = JSON.parse(dataMatch[1].trim());
              
              switch (eventType) {
                case 'start':
                  // Model info - we can use this if needed
                  console.log('AI model started responding:', data.model);
                  break;
                  
                case 'chunk':
                  // Update the AI message with the new chunk
                  aiMessage.content += data.content;
                  
                  // Update the current session with the updated AI message
                  const updatedMessages = sessionWithAiMessage.messages.map(msg => 
                    msg.id === aiMessageId ? { ...aiMessage } : msg
                  );
                  
                  setCurrentSession({
                    ...sessionWithAiMessage,
                    messages: updatedMessages
                  });
                  break;
                  
                case 'done':
                  // Final update with token count and cost
                  aiMessage.tokens = data.tokens;
                  aiMessage.cost = data.cost;
                  
                  // Insert AI message in Supabase
                  const { error: aiMsgError } = await supabase
                    .from('chat_messages')
                    .insert({
                      id: aiMessageId,
                      session_id: currentSession.id,
                      content: aiMessage.content,
                      sender: "ai",
                      model: data.model,
                      tokens: data.tokens,
                      cost: data.cost
                    });
                    
                  if (aiMsgError) {
                    console.error('Error inserting AI message:', aiMsgError);
                    toast.error('Error saving response');
                  }
                  
                  // Update session in Supabase with new tokens and cost
                  const newTotalTokens = (currentSession.totalTokens || 0) + data.tokens;
                  const newTotalCost = (currentSession.totalCost || 0) + data.cost;
                  
                  const { error: sessionUpdateError } = await supabase
                    .from('chat_sessions')
                    .update({
                      total_tokens: newTotalTokens,
                      total_cost: newTotalCost,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', currentSession.id);
                    
                  if (sessionUpdateError) {
                    console.error('Error updating session:', sessionUpdateError);
                  }
                  
                  // Update final session locally with AI message and costs
                  const finalSession = {
                    ...sessionWithAiMessage,
                    messages: sessionWithAiMessage.messages.map(msg => 
                      msg.id === aiMessageId ? aiMessage : msg
                    ),
                    totalTokens: newTotalTokens,
                    totalCost: newTotalCost,
                    title: newTitle
                  };
                  
                  // Update current session and chat history
                  setCurrentSession(finalSession);
                  setChatHistory(prev => 
                    prev.map(session => 
                      session.id === currentSession.id ? finalSession : session
                    )
                  );
                  break;
                  
                case 'error':
                  console.error('Error from Gemini:', data.error);
                  toast.error(`AI Error: ${data.error}`);
                  
                  // Update the AI message to show the error
                  aiMessage.content += `\n\nError: ${data.error}`;
                  
                  // Update the UI with the error message
                  const errorMessages = sessionWithAiMessage.messages.map(msg => 
                    msg.id === aiMessageId ? aiMessage : msg
                  );
                  
                  setCurrentSession({
                    ...sessionWithAiMessage,
                    messages: errorMessages
                  });
                  break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in streaming response:', error);
        toast.error('Error processing AI response');
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      toast.error('Error processing message');
    } finally {
      setIsProcessing(false);
    }
  };

  return { sendMessage };
};
