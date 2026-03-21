// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { JoinPage } from './pages/JoinPage';
import { EngageStreamPage } from './pages/EngageStreamPage';
import { InviteCodeHandlerPage } from './pages/InviteCodeHandlerPage';
import { PublicPresentationViewerPage } from './pages/PublicPresentationViewerPage';
import { Toaster } from "sonner";
import { ThemeProvider } from './components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vacademy-learner-theme">
      <Router>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/:inviteCode" element={<InviteCodeHandlerPage />} />
          <Route path="/engage/:inviteCode" element={<EngageStreamPage />} />
          <Route path="/presentation/public/:presentationId" element={<PublicPresentationViewerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} /> {/* Fallback route */}
        </Routes>
        <Toaster richColors position="top-center" />
      </Router>
    </ThemeProvider>
  );
}

export default App;
