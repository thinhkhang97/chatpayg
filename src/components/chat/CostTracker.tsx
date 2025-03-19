
import { useChat } from "@/contexts/ChatContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Zap } from "lucide-react";

const CostTracker = () => {
  const { currentSession, totalCost } = useChat();
  
  const sessionTokens = currentSession?.totalTokens || 0;
  const sessionCost = currentSession?.totalCost || 0;

  return (
    <div className="p-4 border-t">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <DollarSign size={14} className="mr-1" />
            Cost Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center">
              <Zap size={14} className="mr-1" />
              Current Chat:
            </span>
            <span className="font-medium">
              {sessionTokens} tokens (${sessionCost.toFixed(4)})
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Used:</span>
            <span className="font-medium">${totalCost.toFixed(4)}</span>
          </div>
          
          <div className="pt-1 text-xs text-muted-foreground border-t">
            This is a demo with mock data
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostTracker;
