
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Zap, History, DollarSign } from "lucide-react";

const LandingPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, signup } = useAuth();

  const handleAuth = async (type: "login" | "signup") => {
    setIsLoading(true);
    try {
      if (type === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Hero Section */}
      <div className="w-full md:w-1/2 bg-hero-gradient text-white p-8 md:p-16 flex flex-col justify-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
          Chat with AI - Pay as You Go
        </h1>
        <p className="text-xl mb-8 opacity-90">
          Chat with powerful AI models instantly and pay only for what you use.
        </p>
        
        <div className="space-y-8 mt-8">
          <div className="flex items-start space-x-4">
            <div className="bg-white/10 p-3 rounded-lg">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Multiple AI Models</h3>
              <p className="opacity-80">Choose between OpenAI GPT and Google's Gemini</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="bg-white/10 p-3 rounded-lg">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Instant Responses</h3>
              <p className="opacity-80">Get fast, accurate AI-powered answers</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="bg-white/10 p-3 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Pay As You Go</h3>
              <p className="opacity-80">Only pay for the tokens you actually use</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="bg-white/10 p-3 rounded-lg">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Chat History</h3>
              <p className="opacity-80">All your conversations saved and accessible</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Section */}
      <div className="w-full md:w-1/2 bg-card p-8 md:p-16 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground">Get Started</h2>
            <p className="text-muted-foreground mt-2">Sign up or log in to continue</p>
          </div>
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Log In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-login">Email</Label>
                <Input 
                  id="email-login" 
                  type="email" 
                  placeholder="your@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-login">Password</Label>
                <Input 
                  id="password-login" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button 
                className="w-full mt-6" 
                onClick={() => handleAuth("login")}
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Logging in...
                  </span>
                ) : (
                  "Log In"
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-signup">Email</Label>
                <Input 
                  id="email-signup" 
                  type="email" 
                  placeholder="your@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signup">Password</Label>
                <Input 
                  id="password-signup" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </p>
              </div>
              <Button 
                className="w-full mt-6" 
                onClick={() => handleAuth("signup")}
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Creating account...
                  </span>
                ) : (
                  "Sign Up"
                )}
              </Button>
            </TabsContent>
          </Tabs>
          
          <div className="text-center text-sm mt-8 text-muted-foreground">
            <p>This is a demo app with mock authentication</p>
            <p>No real authentication or charges will occur</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
