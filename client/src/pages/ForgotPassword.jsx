import { useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './AuthShared.css';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your email address.');

    setLoading(true);
    try {
      await userService.forgotPassword({
  email: email.trim().toLowerCase()
});
      setSent(true);
      toast.success('Reset link sent! Check your inbox.');
    } catch {
      setSent(true); // anti-enumeration: always show success
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-grid-overlay" />

      <div className="auth-card">
        <div className="auth-card-logo">🎓</div>
        <h1 className="auth-card-title">Forgot Password</h1>
        <p className="auth-card-sub">Enter your registered email and we'll send you a reset link.</p>

        {sent ? (
          <div className="auth-success-box">
            <div className="auth-success-icon">📬</div>
            <h3>Check your inbox</h3>
            <p>We sent a reset link to <strong>{email}</strong>. It expires in <strong>15 minutes</strong>.</p>
            <p className="auth-success-hint">
              Didn't receive it? Check spam or{' '}
              <button className="auth-text-btn" onClick={() => setSent(false)}>try again</button>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <span className="auth-icon">✉️</span>
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  autoFocus
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
              {loading
                ? <><span className="auth-spinner" />Sending…</>
                : <><span>Send Reset Link</span><span className="auth-arrow">→</span></>
              }
            </button>
          </form>
        )}

        <p className="auth-footer-link">
          Remember your password? <Link to="/login" className="auth-anchor">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}