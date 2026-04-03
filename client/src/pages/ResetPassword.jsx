import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { userService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './AuthShared.css';

function getStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 6)                        score++;
  if (pw.length >= 10)                       score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))                      score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;
  const levels = [
    null,
    { label: 'Very weak',   color: '#ef4444', width: '20%'  },
    { label: 'Weak',        color: '#f97316', width: '40%'  },
    { label: 'Fair',        color: '#f59e0b', width: '60%'  },
    { label: 'Strong',      color: '#22c55e', width: '80%'  },
    { label: 'Very strong', color: '#10b981', width: '100%' },
  ];
  return { score, ...levels[Math.min(score, 5)] };
}

function PasswordInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-icon">🔒</span>
        <input
          className="auth-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button type="button" className="auth-eye-btn" onClick={() => setShow(s => !s)}>
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const [newPassword,     setNew]     = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [loading, setLoading]         = useState(false);
  const [done,    setDone]            = useState(false);
  const strength = getStrength(newPassword);

  const handleSubmit = async e => {
    e.preventDefault();
    if (newPassword.length < 6)
      return toast.error('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword)
      return toast.error('Passwords do not match.');
    if (strength && strength.score < 2)
      return toast.error('Password too weak. Add uppercase letters or numbers.');

    setLoading(true);
    try {
      await userService.resetPassword(token, newPassword);
      setDone(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset link is invalid or has expired.');
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
        <h1 className="auth-card-title">Reset Password</h1>
        <p className="auth-card-sub">Enter your new password below.</p>

        {done ? (
          <div className="auth-success-box">
            <div className="auth-success-icon">✅</div>
            <h3>Password reset!</h3>
            <p>Your password has been updated successfully.</p>
            <p className="auth-success-hint">Redirecting you to login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={e => setNew(e.target.value)}
              placeholder="Min. 6 characters"
            />

            {newPassword && strength && (
              <div className="auth-strength">
                <div className="auth-strength-track">
                  <div className="auth-strength-fill"
                    style={{ width: strength.width, background: strength.color }} />
                </div>
                <div className="auth-strength-meta">
                  <span style={{ color: strength.color, fontSize: 12, fontWeight: 600 }}>
                    {strength.label}
                  </span>
                  <span className="auth-hint">
                    {strength.score < 3 ? 'Add uppercase, numbers, symbols' : 'Looking good!'}
                  </span>
                </div>
              </div>
            )}

            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
            />

            {confirmPassword && (
              <p style={{
                fontSize: 12, fontWeight: 600, marginTop: -8, marginBottom: 14,
                color: newPassword === confirmPassword ? '#4ade80' : '#f87171',
              }}>
                {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}

            <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
              {loading
                ? <><span className="auth-spinner" />Resetting…</>
                : <><span>Reset Password</span><span className="auth-arrow">→</span></>
              }
            </button>
          </form>
        )}

        <p className="auth-footer-link">
          <Link to="/login" className="auth-anchor">← Back to Login</Link>
        </p>
      </div>
    </div>
  );
}