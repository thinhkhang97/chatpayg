
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

export type ChatContextType = {
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
