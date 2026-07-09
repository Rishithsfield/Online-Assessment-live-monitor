import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import CandidateIDE from './pages/CandidateIDE';
import RecruiterConsole from './pages/RecruiterConsole';

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/ide" element={<CandidateIDE />} />
          <Route path="/recruiter" element={<RecruiterConsole />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </SocketProvider>
  );
}
