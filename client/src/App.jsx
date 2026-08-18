import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
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
import useFirebaseNotifications from './hooks/useFirebaseNotifications';


const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// Redirects logged-in users away from public-only pages
const PublicRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
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
  useFirebaseNotifications(isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Keep the JWT in Cache API so the service worker can read it for
    // attendance quick-actions on notification buttons.
    const saveJwtToCache = async () => {
      try {
        const jwt = localStorage.getItem('token');
        if (jwt) {
          const cache = await caches.open('auth-cache');
          await cache.put('auth-token', new Response(JSON.stringify({ token: jwt })));
        }
      } catch (err) {
        console.error('[Cache] Failed:', err);
      }
    };

    saveJwtToCache();
    // FCM token registration ΓåÆ AuthContext.login()
    // Foreground push handler   ΓåÆ useFirebaseNotifications hook
  }, [isLoggedIn]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
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
