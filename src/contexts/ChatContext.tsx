import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

export type AIModel = "openai" | "gemini";

export type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  model: AIModel;
  tokens?: number;
  cost?: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model: AIModel;
  totalCost: number;
  totalTokens: number;
};

type ChatContextType = {
  currentModel: AIModel;
  setCurrentModel: (model: AIModel) => void;
  chatHistory: ChatSession[];
  currentSession: ChatSession | null;
  createNewSession: () => void;
  sendMessage: (content: string) => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  isProcessing: boolean;
  totalCost: number;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentModel, setCurrentModel] = useState<AIModel>("gemini");
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch chat history from Supabase when user changes
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!user) {
        setChatHistory([]);
        setCurrentSession(null);
        setIsInitialized(true);
        return;
      }

      try {
        // Fetch chat sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('chat_sessions')
          .select('*')
          .order('updated_at', { ascending: false });

        if (sessionsError) {
          toast.error('Error fetching chat history');
          console.error('Error fetching chat history:', sessionsError);
          setIsInitialized(true);
          return;
        }

        // Transform sessions to our format and fetch messages for each
        const formattedSessions: ChatSession[] = [];
        
        for (const session of sessions) {
          const { data: messages, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', session.id)
            .order('timestamp', { ascending: true });

          if (messagesError) {
            console.error('Error fetching messages for session:', messagesError);
            continue;
          }

          // Format messages
          const formattedMessages: Message[] = messages.map((msg) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender as "user" | "ai",
            timestamp: new Date(msg.timestamp),
            model: msg.model as AIModel,
            tokens: msg.tokens,
            cost: msg.cost
          }));

          // Add session to our formatted list
          formattedSessions.push({
            id: session.id,
            title: session.title,
            messages: formattedMessages,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
            model: session.model as AIModel,
            totalCost: Number(session.total_cost),
            totalTokens: session.total_tokens
          });
        }

        setChatHistory(formattedSessions);

        // Set current session to the most recent if it exists
        if (formattedSessions.length > 0) {
          setCurrentSession(formattedSessions[0]);
        } else {
          await createNewSession();
        }
      } catch (error) {
        console.error('Error in fetchChatHistory:', error);
        toast.error('Error loading chat history');
      } finally {
        setIsInitialized(true);
      }
    };

    fetchChatHistory();
  }, [user]);

  // Calculate total cost whenever chat history changes
  useEffect(() => {
    const newTotalCost = chatHistory.reduce((sum, session) => 
      sum + session.totalCost, 0);
    setTotalCost(newTotalCost);
  }, [chatHistory]);

  const createNewSession = async () => {
    if (!user) {
      toast.error('You must be logged in to create a new chat');
      return;
    }

    const sessionId = uuidv4();
    const newSession: ChatSession = {
      id: sessionId,
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model: currentModel,
      totalCost: 0,
      totalTokens: 0
    };
    
    try {
      // Insert new session in Supabase
      const { error } = await supabase
        .from('chat_sessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          title: "New Chat",
          model: currentModel
        });

      if (error) {
        toast.error('Error creating new chat');
        console.error('Error creating new chat:', error);
        return;
      }

      setChatHistory(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
    } catch (error) {
      console.error('Error in createNewSession:', error);
      toast.error('Failed to create new chat');
    }
  };

  const selectSession = (sessionId: string) => {
    const session = chatHistory.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      setCurrentModel(session.model);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        toast.error('Error deleting chat');
        console.error('Error deleting chat:', error);
        return;
      }

      // Update local state
      setChatHistory(prev => prev.filter(session => session.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        if (chatHistory.length > 1) {
          // Select the next available session
          const nextSession = chatHistory.find(session => session.id !== sessionId);
          setCurrentSession(nextSession || null);
        } else {
          // Create a new session if this was the last one
          await createNewSession();
        }
      }

      toast.success('Chat deleted');
    } catch (error) {
      console.error('Error in deleteSession:', error);
      toast.error('Failed to delete chat');
    }
  };

  const sendMessage = async (content: string) => {
    if (!currentSession || !content.trim() || isProcessing || !user) return;
    
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

  if (!isInitialized) {
    return <div className="flex items-center justify-center h-screen">Loading chats...</div>;
  }

  return (
    <ChatContext.Provider 
      value={{
        currentModel,
        setCurrentModel,
        chatHistory,
        currentSession,
        createNewSession,
        sendMessage,
        selectSession,
        deleteSession,
        isProcessing,
        totalCost
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
