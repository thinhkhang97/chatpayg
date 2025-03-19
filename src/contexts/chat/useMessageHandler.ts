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
      
      // Prepare for AI response
      try {
        // Create AI message that will be updated with content
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
        
        // Prepare messages for the API (including context)
        const messagesForAPI = sessionWithAiMessage.messages.map(msg => ({
          sender: msg.sender,
          content: msg.content,
          model: msg.model
        }));
        
        console.log("Calling Edge Function for Gemini");
        
        // Call the appropriate edge function based on model
        if (currentModel === "gemini") {
          // Use Supabase functions invoke to call the edge function directly
          const { data: response, error: functionError } = await supabase.functions.invoke('chat-with-gemini', {
            body: JSON.stringify({
              messages: messagesForAPI,
              user_id: user.id,
              session_id: currentSession.id
            })
          });
          
          // Check if there was an error invoking the function
          if (functionError) {
            console.error("Error invoking edge function:", functionError);
            aiMessage.content = "Error: Failed to connect to AI service. Please try again later.";
            
            const errorMessages = sessionWithAiMessage.messages.map(msg => 
              msg.id === aiMessageId ? aiMessage : msg
            );
            
            setCurrentSession({
              ...sessionWithAiMessage,
              messages: errorMessages
            });
            
            toast.error("Failed to connect to AI service");
            return;
          }
          
          console.log("Received response from Gemini:", response);
          
          // Process the Gemini response
          if (response && response.data) {
            aiMessage.content = response.data.content || "No response from AI service";
            aiMessage.tokens = response.data.tokens;
            aiMessage.cost = response.data.cost;
            
            // Insert AI message in Supabase
            const { error: aiMsgError } = await supabase
              .from('chat_messages')
              .insert({
                id: aiMessageId,
                session_id: currentSession.id,
                content: aiMessage.content,
                sender: "ai",
                model: currentModel,
                tokens: aiMessage.tokens,
                cost: aiMessage.cost
              });
              
            if (aiMsgError) {
              console.error('Error inserting AI message:', aiMsgError);
              toast.error('Error saving response');
            }
            
            // Update final session locally with AI message
            const finalMessages = sessionWithAiMessage.messages.map(msg => 
              msg.id === aiMessageId ? aiMessage : msg
            );
            
            const finalSession = {
              ...sessionWithAiMessage,
              messages: finalMessages,
              title: newTitle
            };
            
            // Update current session and chat history
            setCurrentSession(finalSession);
            setChatHistory(prev => 
              prev.map(session => 
                session.id === currentSession.id ? finalSession : session
              )
            );
          } else {
            // No valid response data
            aiMessage.content = "Error: Received invalid response from AI service";
            
            const errorMessages = sessionWithAiMessage.messages.map(msg => 
              msg.id === aiMessageId ? aiMessage : msg
            );
            
            setCurrentSession({
              ...sessionWithAiMessage,
              messages: errorMessages
            });
            
            toast.error("Received invalid response from AI service");
          }
        } else {
          // Handle other models (like OpenAI) here
          // ... keep existing code (OpenAI handling)
        }
      } catch (error) {
        console.error('Error in AI response:', error);
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
