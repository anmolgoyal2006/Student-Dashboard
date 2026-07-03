import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider, toast } from './context/ToastContext';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import LandingPage from './pages/landing/LandingPage';
import { motion } from 'framer-motion';
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
import Analytics from './pages/Analytics';
import AttendancePrompt from './components/AttendancePrompt';
import AdminPanel from './pages/AdminPanel';
import AdminOpportunities from './pages/admin/Opportunities';
import LoginSuccess from './pages/LoginSuccess';
import { getFCMToken, getMessagingInstance } from './firebase';
import { onMessage } from 'firebase/messaging';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => {
  const isProduction = process.env.REACT_APP_ENV === 'production' || process.env.VITE_APP_ENV === 'production';
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
      {/* Hide debug overlays in production */}
      {!isProduction && (
        <div id="debug-overlay-root" style={{ display: 'none' }} />
      )}
      <AttendancePrompt />
    </div>
  );
};

export default function App() {
  const { isLoggedIn } = useAuth();

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

    saveJwtToCache();
    initFCM();

    const messaging = getMessagingInstance();
    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload?.notification || {};
      const data = payload?.data || {};

      if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title || 'StudentAI', {
            body: body || '',
            icon: '/logo192.png',
            badge: '/logo192.png',
            data: {
              subjectId: data.subjectId || '',
              date: data.date || '',
              url: data.url || '/',
            },
            actions: data.subjectId ? [
              { action: 'attended',     title: '✅ Attended'    },
              { action: 'not_attended', title: '❌ Not Attended' },
              { action: 'not_held',     title: '⏸ Not Held'     },
            ] : [],
          });
        });
      } else if (title || body) {
        toast.info(`${title}: ${body}`);
      }
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={
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
          <Route path="/attendance/upload" element={
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
          <Route path="/admin" element={
            <ProtectedRoute><AppLayout><AdminPanel /></AppLayout></ProtectedRoute>
          } />
          <Route path="/admin/opportunities" element={
            <ProtectedRoute><AppLayout><AdminOpportunities /></AppLayout></ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}