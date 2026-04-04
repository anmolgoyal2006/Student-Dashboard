import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

         <Route path="/forgot-password"       element={<ForgotPassword />} />
         
<Route path="/reset-password/:token" element={<ResetPassword />}  />

        <Route path="/" element={
          <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
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
  <ProtectedRoute>
    <AppLayout><ProfileSettings /></AppLayout>
  </ProtectedRoute>
} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
