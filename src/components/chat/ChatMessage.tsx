
import { Message } from "@/contexts/ChatContext";
import { Avatar } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { DollarSign } from "lucide-react";

type ChatMessageProps = {
  message: Message;
};

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.sender === "user";
  const logo = message.model === "openai" ? "O" : "G";
  const modelColor = message.model === "openai" ? "bg-emerald-600" : "bg-blue-600";
  
  return (
    <div 
      className={`py-6 first:pt-0 ${isUser ? "bg-background" : "bg-secondary/30"} message-enter`}
    >
      <div className="container max-w-4xl flex gap-4">
        <Avatar className={`h-8 w-8 ${isUser ? "bg-primary" : modelColor} text-primary-foreground`}>
          <span className="text-sm font-medium">
            {isUser ? "U" : logo}
          </span>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">
              {isUser ? "You" : message.model === "openai" ? "OpenAI GPT" : "Gemini"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </span>
            
            {!isUser && message.cost && (
              <span className="ml-auto text-xs flex items-center text-muted-foreground gap-1">
                <DollarSign size={12} />
                {message.cost.toFixed(4)} ({message.tokens} tokens)
              </span>
            )}
          </div>
          
          <div className="text-foreground whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
