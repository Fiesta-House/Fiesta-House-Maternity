import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import BookingDetails from "./pages/BookingDetails";
import Conversations from "./pages/Conversations";
import Customers from "./pages/Customers";
import AIModelMonitoringPage from "./pages/AIModelMonitoringPage";
import CustomerDetailsPage from "./pages/CustomerDetailsPage";
import WhatsApp from "./pages/WhatsApp";
import WhatsAppTemplates from "./pages/WhatsAppTemplates";
import Instagram from "./pages/Instagram";
import KnowledgeBase from "./pages/KnowledgeBase";
import Settings from "./pages/Settings";
import InstagramIntegration from "./pages/InstagramIntegration";
import PackagesPage from "./pages/Packages";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { useAuthStore } from "./state/authStore";
import Escalations from "./pages/Escalations";
import Notifications from "./pages/Notifications";
import MessengerPage from "./pages/MessengerPage";
import SystemStatus from "./pages/SystemStatus";
import RagInsights from "./pages/RagInsights";
import AiInstructions from "./pages/AiInstructions";
import BookingDrafts from "./pages/BookingDrafts";


const queryClient = new QueryClient();

const AppRouter = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Bookings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings/:bookingId"
            element={
              <ProtectedRoute>
                <Layout>
                  <BookingDetails />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <Layout>
                  <Conversations />
                </Layout>
              </ProtectedRoute>
            }
          />
           <Route
            path="/AIModelMonitoringPage"
            element={
              <ProtectedRoute>
                <Layout>
                  <AIModelMonitoringPage />
                </Layout>
              </ProtectedRoute>
            }
          />


          
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Layout>
                  <Customers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:customerId"
            element={
              <ProtectedRoute>
                <Layout>
                  <CustomerDetailsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/escalations"
            element={
              <ProtectedRoute>
                <Layout>
                  <Escalations />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <Layout>
                  <WhatsApp />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp/templates"
            element={
              <ProtectedRoute>
                <Layout>
                  <WhatsAppTemplates />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/packages"
            element={
              <ProtectedRoute>
                <Layout>
                  <PackagesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
                 <Route
  path="/booking-drafts"
  element={
    <ProtectedRoute>
      <Layout>
        <BookingDrafts />
      </Layout>
    </ProtectedRoute>
  }
/>
          <Route
            path="/instagram"
            element={
              <ProtectedRoute>
                <Layout>
                  <Instagram />
                </Layout>
              </ProtectedRoute>
            }
          />
   
          <Route
            path="/knowledge-base"
            element={
              <ProtectedRoute>
                <Layout>
                  <KnowledgeBase />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rag-insights"
            element={
              <ProtectedRoute>
                <Layout>
                  <RagInsights />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-instructions"
            element={
              <ProtectedRoute>
                <Layout>
                  <AiInstructions />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/integrations/instagram"
            element={
              <ProtectedRoute>
                <Layout>
                  <InstagramIntegration />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messenger"
            element={
              <ProtectedRoute>
                <Layout>
                  <MessengerPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-status"
            element={
              <ProtectedRoute>
                <Layout>
                  <SystemStatus />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default AppRouter;
