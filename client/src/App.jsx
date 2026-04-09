import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import Login      from './pages/Login';
import Signup     from './pages/Signup';
import Dashboard  from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Marks      from './pages/Marks';
import Timetable  from './pages/Timetable';
import Career     from './pages/Career';
import Scheduler  from './pages/Scheduler';
import ProfileSettings from './pages/ProfileSettings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import AIAssistant from './pages/AIAssistant';
import Prediction from './pages/Prediction';
import LoginSuccess from './pages/LoginSuccess';
import { getFCMToken, onMessageListener } from './firebase';
import toast from 'react-hot-toast';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => (
  <div className="layout">
    <Sidebar />
    <main className="main-content">{children}</main>
  </div>
);

export default function App() {
  const { isLoggedIn } = useAuth();

  // AFTER
useEffect(() => {
  if (!isLoggedIn) return;

  const saveJwtToCache = async () => {
    try {
      const jwt = localStorage.getItem('token');
      if (jwt) {
        const cache = await caches.open('auth-cache');
        await cache.put('auth-token', new Response(JSON.stringify({ token: jwt })));
        console.log('[Cache] JWT saved for SW');
      }
    } catch (err) {
      console.error('[Cache] Failed:', err);
    }
  };

  const initFCM = async () => {
    try {
      const fcmToken = await getFCMToken();
      if (fcmToken) {
        const jwt = localStorage.getItem('token');
        await axios.post(
          `${process.env.REACT_APP_API_URL}/user/save-token`,
          { token: fcmToken },
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        console.log('[FCM] Token saved');
      }
    } catch (err) {
      console.error('[FCM Init]', err.message);
    }
  };

  const listenForMessages = async () => {
    try {
      const payload = await onMessageListener();
      const { title, body } = payload?.notification || {};
      if (title || body) {
        toast(`🔔 ${title}: ${body}`, { duration: 5000 });
      }
    } catch (err) {
      console.error('[FCM Listener]', err.message);
    }
  };

  saveJwtToCache();
  initFCM();
  listenForMessages();
}, [isLoggedIn]);                                  // ← re-runs on login
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/" element={
          <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
        } />
        <Route path="/login-success" element={<LoginSuccess />} />
        <Route path="/prediction" element={
          <ProtectedRoute><AppLayout><Prediction /></AppLayout></ProtectedRoute>
        } />
        <Route path="/timetable" element={
          <ProtectedRoute><AppLayout><Timetable /></AppLayout></ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute><AppLayout><Attendance /></AppLayout></ProtectedRoute>
        } />
        <Route path="/marks" element={
          <ProtectedRoute><AppLayout><Marks /></AppLayout></ProtectedRoute>
        } />
        <Route path="/career" element={
          <ProtectedRoute><AppLayout><Career /></AppLayout></ProtectedRoute>
        } />
        <Route path="/scheduler" element={
          <ProtectedRoute><AppLayout><Scheduler /></AppLayout></ProtectedRoute>
        } />
        <Route path="/ai-assistant" element={
          <ProtectedRoute><AppLayout><AIAssistant /></AppLayout></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><AppLayout><ProfileSettings /></AppLayout></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}