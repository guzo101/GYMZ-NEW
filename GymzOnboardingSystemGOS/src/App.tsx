import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Apply from "./pages/Apply";

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/apply" replace />} />
          <Route path="/apply" element={<Apply />} />
          {/* Add more onboarding routes here if needed */}
          <Route path="*" element={<Navigate to="/apply" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
