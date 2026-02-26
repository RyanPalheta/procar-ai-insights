import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetails from "./pages/LeadDetails";
import Calls from "./pages/Calls";
import Interactions from "./pages/Interactions";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import TVDashboard from "./pages/TVDashboard";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";
import Sellers from "./pages/Sellers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Leads />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads/:leadId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <LeadDetails />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calls"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Calls />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interactions"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Interactions />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Logs />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <UserManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sellers"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout>
                    <Sellers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tv"
              element={
                <ProtectedRoute>
                  <TVDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
