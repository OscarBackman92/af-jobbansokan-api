import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function EmployerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_employer) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-af-blue border-t-transparent" />
  );
}
