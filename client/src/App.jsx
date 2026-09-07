import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import AttendancePrompt from './components/AttendancePrompt';
import IOSInstallBanner from './components/IOSInstallBanner';
import useFirebaseNotifications from './hooks/useFirebaseNotifications';

// ── Lazy-loaded pages — each becomes its own JS chunk ────────────────────────
// Auth / public pages (small, loaded first)
const LandingPage  = lazy(() => import('./pages/landing/LandingPage'));
const Login        = lazy(() => import('./pages/Login'));
const Signup       = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const LoginSuccess   = lazy(() => import('./pages/LoginSuccess'));

// Protected app pages
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Attendance   = lazy(() => import('./pages/Attendance'));
const Marks        = lazy(() => import('./pages/Marks'));
const Timetable    = lazy(() => import('./pages/Timetable'));
const Career       = lazy(() => import('./pages/Career'));
const Scheduler    = lazy(() => import('./pages/Scheduler'));
const ProfileSettings      = lazy(() => import('./pages/ProfileSettings'));
const AIAssistant  = lazy(() => import('./pages/AIAssistant'));
const Prediction   = lazy(() => import('./pages/Prediction'));
const Analytics    = lazy(() => import('./pages/Analytics'));
const NotificationDiagnostic = lazy(() => import('./pages/NotificationDiagnostic'));
const AdminPanel   = lazy(() => import('./pages/AdminPanel'));
const AdminOpportunities = lazy(() => import('./pages/admin/Opportunities'));

// ── Page-transition animation — kept as a normal import since framer-motion
//    is already used throughout the app shell (Sidebar etc.) and is not
//    route-specific; it ships in the main chunk alongside the layout.
import { motion } from 'framer-motion';

// ── Loading fallback shown while a lazy chunk is downloading ─────────────────
const PageLoader = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '12px',
    background: 'var(--color-bg-primary, #0f0f0f)',
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      border: '3px solid var(--color-border, #333)',
      borderTopColor: 'var(--color-accent, #7c3aed)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: 'var(--color-text-secondary, #aaa)', fontSize: '14px' }}>
      Loading…
    </span>
  </div>
);


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
        {/* iOS Safari: prompt non-standalone users to install the PWA so
            Web Push works. Renders nothing on Android/desktop/installed PWA. */}
        <IOSInstallBanner />
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/notifications/diagnostic" element={
              <ProtectedRoute><AppLayout><NotificationDiagnostic /></AppLayout></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
