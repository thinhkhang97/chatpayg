import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

type RouteGuardProps = {
  children: React.ReactNode;
  requireAuth: boolean;
};

const RouteGuard = ({ children, requireAuth }: RouteGuardProps) => {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If route requires authentication and user is not logged in, redirect to login
  if (requireAuth && !user) {
    return <Navigate to="/" replace />;
  }

  // If user is logged in and tries to access login/signup page, redirect to chat
  if (!requireAuth && user) {
    return <Navigate to="/chat" replace />;
  }

  // Otherwise, render the children
  return <>{children}</>;
};

export default RouteGuard;
