
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/chat";
import RouteGuard from "@/components/RouteGuard";
import LandingPage from "@/pages/LandingPage";
import ChatPage from "@/pages/ChatPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ChatProvider>
          <BrowserRouter>
            <Routes>
              <Route 
                path="/" 
                element={
                  <RouteGuard requireAuth={false}>
                    <LandingPage />
                  </RouteGuard>
                } 
              />
              <Route 
                path="/chat" 
                element={
                  <RouteGuard requireAuth={true}>
                    <ChatPage />
                  </RouteGuard>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
