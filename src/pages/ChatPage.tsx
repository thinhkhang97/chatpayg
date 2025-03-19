
import { useEffect, useRef } from "react";
import { useChat } from "@/contexts/ChatContext";
import { SidebarProvider, SidebarTrigger, Sidebar } from "@/components/ui/sidebar";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import CostTracker from "@/components/chat/CostTracker";
import { Button } from "@/components/ui/button";

const ChatPage = () => {
  const { currentSession, createNewSession } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <ChatSidebar />
        </Sidebar>
        
        <div className="flex-1 flex flex-col h-screen">
          <header className="border-b bg-card p-4 flex items-center justify-between">
            <div className="flex items-center">
              <SidebarTrigger />
              <h1 className="text-xl font-bold ml-4">
                Chat with AI
              </h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto">
            {currentSession?.messages && currentSession.messages.length > 0 ? (
              <div>
                {currentSession.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                  <h2 className="text-2xl font-bold mb-4">Start a conversation</h2>
                  <p className="text-muted-foreground mb-6">
                    Choose a model and start chatting with AI. Your conversations will be saved in the sidebar.
                  </p>
                  <Button onClick={createNewSession}>
                    New Chat
                  </Button>
                </div>
              </div>
            )}
          </main>
          
          <CostTracker />
          <ChatInput />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ChatPage;
