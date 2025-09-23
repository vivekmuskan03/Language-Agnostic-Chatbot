import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Features from './pages/Features';
import Support from './pages/Support';
import Signup from './pages/Signup';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Chat from './pages/Chat';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/features" element={<Features />} />
          <Route path="/support" element={<Support />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
