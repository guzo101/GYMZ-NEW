import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WebsiteHome from "./website/pages/Home";
import PrivacyPolicy from "./website/pages/PrivacyPolicy";
import { WebsiteTrafficRecorder } from "./website/components/WebsiteTrafficRecorder";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WebsiteTrafficRecorder />
          <Routes>
            <Route path="/" element={<WebsiteHome />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="*" element={<WebsiteHome />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
