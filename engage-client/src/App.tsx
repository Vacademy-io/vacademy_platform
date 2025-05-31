// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { JoinPage } from './pages/JoinPage';
import { EngageStreamPage } from './pages/EngageStreamPage';
import { InviteCodeHandlerPage } from './pages/InviteCodeHandlerPage';
import { Toaster } from "sonner";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/:inviteCode" element={<InviteCodeHandlerPage />} />
        <Route path="/engage/:inviteCode" element={<EngageStreamPage />} />
        <Route path="*" element={<Navigate to="/" replace />} /> {/* Fallback route */}
      </Routes>
      <Toaster richColors />
    </Router>
  );
}

export default App;
