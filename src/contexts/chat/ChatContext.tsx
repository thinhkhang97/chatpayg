
import React, { createContext, useContext } from "react";
import { useAuth } from "../AuthContext";
import { ChatContextType } from "./types";
import { useChatOperations } from "./useChatOperations";
import { useMessageHandler } from "./useMessageHandler";

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
  
  const {
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
  } = useChatOperations(user);

  const { sendMessage } = useMessageHandler(
    user,
    currentSession,
    currentModel,
    setCurrentSession,
    setChatHistory,
    setIsProcessing
  );

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
