
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChat, AIModel } from "@/contexts/chat";
import { Send } from "lucide-react";

const ChatInput = () => {
  const [message, setMessage] = useState("");
  const { 
    sendMessage, 
    isProcessing, 
    currentModel, 
    setCurrentModel 
  } = useChat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      sendMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="border-t bg-card p-4"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Model:</span>
          <Select 
            value={currentModel} 
            onValueChange={(value) => setCurrentModel(value as AIModel)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI GPT</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-32 resize-none pr-12"
            disabled={isProcessing}
          />
          <Button 
            size="icon"
            type="submit"
            disabled={!message.trim() || isProcessing}
            className="absolute bottom-3 right-3 h-8 w-8"
          >
            {isProcessing ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          {isProcessing ? "AI is thinking..." : "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
    </form>
  );
};

export default ChatInput;
