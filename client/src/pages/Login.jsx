import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { GraduationCap, Mail, Lock, ArrowRight, Heart, Star } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.login(form);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/');
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
          <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-accent)' }}>
            <GraduationCap size={44} />
          </div>
          <h1 className="brand-title">StudentAI</h1>
          <p className="brand-tagline">Smart academics. Better career. All in one place.</p>

          <div className="login-stats">
            {[
              { value: '10K+', label: 'Students'     },
              { value: '95%',  label: 'Satisfaction' },
              { value: '4.9',  label: 'Rating', icon: <Star size={12} fill="currentColor" style={{ marginLeft: 2 }} /> },
            ].map(s => (
              <div className="stat-pill" key={s.label}>
                <div className="stat-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.value}
                  {s.icon}
                </div>
                <div className="stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="testimonial">
            <p>"StudentAI helped me track my attendance and get placed at Amazon. Best tool for engineers!"</p>
            <div className="testimonial-author">— Priya S., CSE Final Year</div>
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
                  <span className="login-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button className={`login-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {loading ? (
                <span className="btn-spinner" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <a href="https://student-dashboard-irm9.onrender.com/auth/google" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', fontSize: 14, fontWeight: 500, textDecoration: 'none', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit', boxSizing: 'border-box' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continue with Google
            </a>

          </form>

          <p className="login-footer">
            No account?{' '}
            <Link to="/signup" className="login-anchor">Create one free</Link>
          </p>

          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: 24, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.03em' }}>
            Made with <Heart size={12} fill="var(--primary)" color="var(--primary)" /> by <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Anmol Goyal</span>
          </p>
        </div>
      </div>
    </div>
  );
}