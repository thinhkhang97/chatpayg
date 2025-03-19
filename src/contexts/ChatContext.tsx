
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
  const [currentModel, setCurrentModel] = useState<AIModel>("openai");
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

  const getMockResponse = (userMessage: string, model: AIModel): string => {
    if (model === "openai") {
      const responses = [
        "As an OpenAI model, I can help you with that. Here's what I think...",
        "Based on my training data, I would suggest considering...",
        "I've analyzed your question and here's my response from OpenAI...",
        "That's an interesting question. From the OpenAI perspective...",
        "Let me process that for you. According to my understanding..."
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else {
      const responses = [
        "Gemini here! I've processed your request and found that...",
        "From my Gemini knowledge base, I can tell you that...",
        "As Google's Gemini model, I would approach this by...",
        "Interesting query! My Gemini algorithms suggest...",
        "I've searched through my Gemini training data and can confirm..."
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  };

  // Calculate mock token usage and cost
  const calculateMockUsage = (message: string, model: AIModel) => {
    // Mock calculation: 1 token per character, minimum 5 tokens
    const tokens = Math.max(5, Math.ceil(message.length / 2));
    
    // Different pricing for different models
    const rate = model === "openai" ? 0.0005 : 0.0003;
    const cost = tokens * rate;
    
    return { tokens, cost };
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
      
      // Simulate delay for "thinking"
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate mock AI response
      const aiResponseContent = getMockResponse(content, currentModel);
      
      // Calculate mock tokens and cost
      const userUsage = calculateMockUsage(content, currentModel);
      const aiUsage = calculateMockUsage(aiResponseContent, currentModel);
      const totalTokens = userUsage.tokens + aiUsage.tokens;
      const totalMessageCost = userUsage.cost + aiUsage.cost;
      
      // Create AI message
      const aiMessageId = uuidv4();
      const aiMessage: Message = {
        id: aiMessageId,
        content: aiResponseContent,
        sender: "ai",
        timestamp: new Date(),
        model: currentModel,
        tokens: aiUsage.tokens,
        cost: aiUsage.cost
      };

      // Insert AI message in Supabase
      const { error: aiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          id: aiMessageId,
          session_id: currentSession.id,
          content: aiResponseContent,
          sender: "ai",
          model: currentModel,
          tokens: aiUsage.tokens,
          cost: aiUsage.cost
        });

      if (aiMsgError) {
        console.error('Error inserting AI message:', aiMsgError);
        toast.error('Error receiving response');
        setIsProcessing(false);
        return;
      }
      
      // Update session title if this is the first message
      const isFirstMessage = currentSession.messages.length === 0;
      const newTitle = isFirstMessage ? content.slice(0, 30) + "..." : currentSession.title;
      
      // Update session in Supabase with new tokens, cost, and title if needed
      const { error: sessionUpdateError } = await supabase
        .from('chat_sessions')
        .update({
          total_tokens: (currentSession.totalTokens || 0) + totalTokens,
          total_cost: (currentSession.totalCost || 0) + totalMessageCost,
          title: newTitle,
          updated_at: new Date().toISOString(),
          model: currentModel
        })
        .eq('id', currentSession.id);
        
      if (sessionUpdateError) {
        console.error('Error updating session:', sessionUpdateError);
      }
      
      // Update final session locally with AI message and costs
      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, aiMessage],
        totalTokens: (currentSession.totalTokens || 0) + totalTokens,
        totalCost: (currentSession.totalCost || 0) + totalMessageCost,
        title: newTitle
      };
      
      // Update current session
      setCurrentSession(finalSession);
      
      // Update session in history
      setChatHistory(prev => 
        prev.map(session => 
          session.id === currentSession.id ? finalSession : session
        )
      );
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
