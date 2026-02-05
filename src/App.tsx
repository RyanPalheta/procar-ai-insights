import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetails from "./pages/LeadDetails";
import Calls from "./pages/Calls";
import Interactions from "./pages/Interactions";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import TVDashboard from "./pages/TVDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            }
          />
          <Route
            path="/leads"
            element={
              <AppLayout>
                <Leads />
              </AppLayout>
            }
          />
          <Route
            path="/leads/:leadId"
            element={
              <AppLayout>
                <LeadDetails />
              </AppLayout>
            }
          />
          <Route
            path="/calls"
            element={
              <AppLayout>
                <Calls />
              </AppLayout>
            }
          />
          <Route
            path="/interactions"
            element={
              <AppLayout>
                <Interactions />
              </AppLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AppLayout>
                <Settings />
              </AppLayout>
            }
          />
          <Route
            path="/logs"
            element={
              <AppLayout>
                <Logs />
              </AppLayout>
            }
          />
          {/* TV Dashboard - Fullscreen without AppLayout */}
          <Route path="/tv" element={<TVDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
