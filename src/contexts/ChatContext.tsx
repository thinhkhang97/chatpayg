
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

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

  // Load chat history from localStorage when component mounts or user changes
  useEffect(() => {
    if (user) {
      const savedHistory = localStorage.getItem("chatHistory");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        
        // Convert string dates back to Date objects
        const historyWithDates = parsed.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        
        setChatHistory(historyWithDates);
        
        // Set current session to the most recent one if it exists
        if (historyWithDates.length > 0) {
          setCurrentSession(historyWithDates[0]);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    } else {
      setChatHistory([]);
      setCurrentSession(null);
    }
  }, [user]);

  // Calculate total cost whenever chat history changes
  useEffect(() => {
    const newTotalCost = chatHistory.reduce((sum, session) => 
      sum + session.totalCost, 0);
    setTotalCost(newTotalCost);
  }, [chatHistory]);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (user && chatHistory.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }
  }, [chatHistory, user]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model: currentModel,
      totalCost: 0,
      totalTokens: 0
    };
    
    setChatHistory(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
  };

  const selectSession = (sessionId: string) => {
    const session = chatHistory.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      setCurrentModel(session.model);
    }
  };

  const deleteSession = (sessionId: string) => {
    setChatHistory(prev => prev.filter(session => session.id !== sessionId));
    
    if (currentSession?.id === sessionId) {
      if (chatHistory.length > 1) {
        // Select the next available session
        const nextSession = chatHistory.find(session => session.id !== sessionId);
        setCurrentSession(nextSession || null);
      } else {
        // Create a new session if this was the last one
        createNewSession();
      }
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
    if (!currentSession || !content.trim() || isProcessing) return;
    
    setIsProcessing(true);
    
    // Create user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content,
      sender: "user",
      timestamp: new Date(),
      model: currentModel
    };
    
    // Update session with user message
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
    const aiMessage: Message = {
      id: crypto.randomUUID(),
      content: aiResponseContent,
      sender: "ai",
      timestamp: new Date(),
      model: currentModel,
      tokens: aiUsage.tokens,
      cost: aiUsage.cost
    };
    
    // Update session with AI message and costs
    const finalSession = {
      ...updatedSession,
      messages: [...updatedSession.messages, aiMessage],
      totalTokens: (currentSession.totalTokens || 0) + totalTokens,
      totalCost: (currentSession.totalCost || 0) + totalMessageCost,
      title: updatedSession.messages.length === 0 ? content.slice(0, 30) + "..." : updatedSession.title
    };
    
    // Update current session
    setCurrentSession(finalSession);
    
    // Update session in history
    setChatHistory(prev => 
      prev.map(session => 
        session.id === currentSession.id ? finalSession : session
      )
    );
    
    setIsProcessing(false);
  };

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
