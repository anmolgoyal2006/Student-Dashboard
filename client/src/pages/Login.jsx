import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { GraduationCap, Mail, Lock, ArrowRight, Check } from 'lucide-react';
import './Login.css';

const features = [
  { label: 'Google Classroom Sync' },
  { label: 'PDF Upload & Leaderboard' },
  { label: 'AI Dashboard Actions' },
  { label: 'LeetCode & Placement Tracker' },
];

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  // Show toast if redirected back with an OAuth error
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const error  = params.get('error');
    if (error === 'google_failed') toast.error('Google sign-in failed. Please try again.');
    if (error === 'server_error')  toast.error('Server error during sign-in. Please try again.');
  });

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.login(form);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Email',    name: 'email',    type: 'email',    placeholder: 'you@college.edu' },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••' },
  ];

  return (
    <div className="login-page">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="grid-overlay" />

      <div className="login-wrapper">
        {/* Left panel */}
        <div className="login-brand">
          <div className="brand-content">
            <div className="brand-icon-wrap">
              <GraduationCap size={38} className="brand-icon" />
            </div>
            <h1 className="brand-title">StudentAI</h1>
            <p className="brand-tagline">Smart academics. Better career. All in one place.</p>
          </div>

          <div className="brand-features">
            {features.map(f => (
              <div className="feature-badge" key={f.label}>
                <Check size={12} className="feature-check" />
                <span className="feature-label">{f.label}</span>
              </div>
            ))}
          </div>

          <div className="brand-trust">
            <span className="trust-name">Built by Anmol Goyal</span>
            <span className="trust-school">PEC Chandigarh &bull; Computer Science</span>
          </div>
        </div>

        {/* Right form */}
        <div className="login-form-panel">
          <div className="login-form-header">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to continue your journey</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">

             {fields.map(f => (
              <div className={`login-field ${focused === f.name ? 'field-focused' : ''}`} key={f.name}>
                <label className="login-label">{f.label}</label>
                <div className="login-input-wrap">
                  <span className="login-icon">
                    {f.name === 'email' ? <Mail size={16} /> : <Lock size={16} />}
                  </span>
                  <input
                    className="login-input"
                    type={f.type}
                    name={f.name}
                    value={form[f.name]}
                    onChange={handleChange}
                    onFocus={() => setFocused(f.name)}
                    onBlur={() => setFocused('')}
                    placeholder={f.placeholder}
                    required
                  />
                  <span className="input-border" />
                </div>
              </div>
            ))}

            <div className="login-forgot">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button className={`login-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-spinner" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <div className="login-divider">
              <div className="divider-line" />
              <span className="divider-text">or continue with</span>
              <div className="divider-line" />
            </div>

            <a
              href="https://student-dashboard-irm9.onrender.com/auth/google"
              className="google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              <span>Continue with Google</span>
            </a>

          </form>

          <p className="login-footer">
            No account?{' '}
            <Link to="/signup" className="login-anchor">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
