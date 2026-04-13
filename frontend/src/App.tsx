import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import { ProtectedRoute, EmployerRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Jobs from "./pages/Jobs";
import Dashboard from "./pages/Dashboard";
import EmployerDashboard from "./pages/EmployerDashboard";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-gray-50">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />
                <Route
                  path="/employer"
                  element={<EmployerRoute><EmployerDashboard /></EmployerRoute>}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
