
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusCircle, Trash2, LogOut, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ChatSidebar = () => {
  const { chatHistory, currentSession, createNewSession, selectSession, deleteSession } = useChat();
  const { user, logout } = useAuth();

  return (
    <div className="w-full h-full flex flex-col bg-sidebar">
      <div className="p-4 border-b">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 mb-4"
          onClick={createNewSession}
        >
          <PlusCircle size={16} />
          New Chat
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {chatHistory.map((session) => (
            <button
              key={session.id}
              onClick={() => selectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md flex items-start gap-2 transition-colors",
                "hover:bg-sidebar-accent group relative",
                currentSession?.id === session.id ? "bg-sidebar-accent" : ""
              )}
            >
              <MessageSquare 
                size={16} 
                className="mt-1 shrink-0"
                color={session.model === "openai" ? "#10a37f" : "#4285f4"}
              />
              <div className="flex-1 truncate">
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="h-7 w-7 opacity-0 group-hover:opacity-100 absolute right-1 top-1"
              >
                <Trash2 size={14} />
              </Button>
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm truncate">
            <span className="text-muted-foreground">Signed in as: </span>
            <span className="font-medium">{user?.email}</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full justify-start gap-2"
          onClick={logout}
        >
          <LogOut size={16} />
          Log Out
        </Button>
      </div>
    </div>
  );
};

export default ChatSidebar;
