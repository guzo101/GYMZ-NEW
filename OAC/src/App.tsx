import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GymsDashboard from "./pages/GymsDashboard";
import GymOnboardingWizard from "./pages/GymOnboardingWizard";
import GymDetailView from "./pages/GymDetailView";
import VerificationReview from "./pages/VerificationReview";
import AuditLogViewer from "./pages/AuditLogViewer";
import Login from "./pages/Login";

// Setup basic protected route (Platform Admin Only)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }

    // Check if user is platform admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (userData?.role === 'platform_admin' || userData?.role === 'super_admin') {
      setIsAuthorized(true);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white">Loading OAC...</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white p-4 text-center">
        <div className="glass-card p-8 rounded-xl max-w-md">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You must be a Platform Admin to access the Owner Admin Console.</p>
          <a href="/login" className="text-green-500 mt-4 block p-2">Return to Login</a>
        </div>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><GymsDashboard /></ProtectedRoute>} />
          <Route path="/onboarding/:gymId" element={<ProtectedRoute><GymOnboardingWizard /></ProtectedRoute>} />
          <Route path="/gym/:gymId" element={<ProtectedRoute><GymDetailView /></ProtectedRoute>} />
          <Route path="/verify/:gymId" element={<ProtectedRoute><VerificationReview /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogViewer /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
