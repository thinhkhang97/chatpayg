
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { AIModel, ChatSession, Message } from "./types";
import { User } from "@supabase/supabase-js";

export const useChatOperations = (user: User | null) => {
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

  return {
    currentModel,
    setCurrentModel,
    chatHistory,
    setChatHistory,
    currentSession,
    setCurrentSession,
    isProcessing,
    setIsProcessing,
    totalCost,
    isInitialized,
    createNewSession,
    selectSession,
    deleteSession
  };
};
