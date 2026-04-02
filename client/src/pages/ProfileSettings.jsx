import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './ProfileSettings.css';

function getPasswordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 6)                        score++;
  if (pw.length >= 10)                       score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))                      score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;

  const meta = [
    null,
    { label: 'Very weak',   color: '#ef4444', width: '20%'  },
    { label: 'Weak',        color: '#f97316', width: '40%'  },
    { label: 'Fair',        color: '#f59e0b', width: '60%'  },
    { label: 'Strong',      color: '#22c55e', width: '80%'  },
    { label: 'Very strong', color: '#10b981', width: '100%' },
  ];
  return { score, ...meta[Math.min(score, 5)] };
}

function Alert({ type, message }) {
  if (!message) return null;
  return (
    <div className={`ps-alert ps-alert--${type}`}>
      <span className="ps-alert-icon">{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
    </div>
  );
}

function PasswordInput({ label, name, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ps-field">
      <label className="ps-label">{label}</label>
      <div className="ps-input-wrap">
        <span className="ps-icon">🔒</span>
        <input
          className="ps-input"
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button type="button" className="ps-eye-btn" onClick={() => setShow(s => !s)}>
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

export default function ProfileSettings() {
  const { user, updateUser,logout} = useAuth();

  const [profile,        setProfile]   = useState({ name: user?.name || '', email: user?.email || '' });
  const [profileStatus,  setPS]        = useState({ type: '', message: '' });
  const [profileLoading, setPL]        = useState(false);

  const [passwords,       setPW]       = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus,  setPwS]      = useState({ type: '', message: '' });
  const [passwordLoading, setPwL]      = useState(false);
  const [strength,        setStrength] = useState(null);

  const handleProfileSubmit = async e => {
    e.preventDefault();
    setPS({ type: '', message: '' });

    const name  = profile.name.trim();
    const email = profile.email.trim().toLowerCase();

    if (name.length < 2)
      return setPS({ type: 'error', message: 'Name must be at least 2 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setPS({ type: 'error', message: 'Please enter a valid email address.' });
    if (name === user?.name && email === user?.email?.toLowerCase())
      return setPS({ type: 'error', message: 'No changes detected.' });

    setPL(true);
    try {
      const { data } = await userService.updateProfile({ name, email });
      updateUser(data.user, data.token);
      setPS({ type: 'success', message: data.message });
      toast.success('Profile updated!');
    } catch (err) {
      setPS({ type: 'error', message: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setPL(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
  e.preventDefault();
  setPwS({ type: '', message: '' });

  const { oldPassword, newPassword, confirmPassword } = passwords;

  if (!oldPassword)
    return setPwS({ type: 'error', message: 'Please enter your current password.' });

  if (newPassword.length < 6)
    return setPwS({ type: 'error', message: 'New password must be at least 6 characters.' });

  if (newPassword === oldPassword)
    return setPwS({ type: 'error', message: 'New password must differ from the current one.' });

  if (newPassword !== confirmPassword)
    return setPwS({ type: 'error', message: 'Passwords do not match.' });

  setPwL(true);

  try {
    const { data } = await userService.changePassword({
      oldPassword,
      newPassword
    });

    setPwS({ type: 'success', message: data.message });

    setPW({
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    setStrength(null);

    toast.success('Password changed! Please log in again.');

    setTimeout(() => {
      logout();
    }, 1500);

  } catch (err) {
    console.log('Password change error:', err.response?.data);

    setPwS({
      type: 'error',
      message: err.response?.data?.message || 'Failed to change password.'
    });

  } finally {
    setPwL(false);
  }
};

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'ST';

  return (
    <div className="ps-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Manage your account information and security</p>
        </div>
      </div>

      <div className="ps-hero">
        <div className="ps-avatar">{initials}</div>
        <div className="ps-hero-info">
          <div className="ps-hero-name">{user?.name}</div>
          <div className="ps-hero-email">{user?.email}</div>
          <div className="ps-hero-pills">
            {user?.college  && <span className="ps-pill">{user.college}</span>}
            {user?.branch   && <span className="ps-pill">{user.branch}</span>}
            {user?.semester && <span className="ps-pill">Sem {user.semester}</span>}
          </div>
        </div>
      </div>

      <div className="ps-grid">

        {/* Card 1 — Update Profile */}
        <div className="ps-card">
          <div className="ps-card-hdr">
            <div className="ps-card-icon ps-card-icon--indigo">👤</div>
            <div>
              <div className="ps-card-title">Update Profile</div>
              <div className="ps-card-sub">Change your name and email address</div>
            </div>
          </div>

          <Alert type={profileStatus.type} message={profileStatus.message} />

          <form onSubmit={handleProfileSubmit} noValidate>
            <div className="ps-field">
              <label className="ps-label">Full Name</label>
              <div className="ps-input-wrap">
                <span className="ps-icon">👤</span>
                <input
                  className="ps-input"
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div className="ps-field">
              <label className="ps-label">Email Address</label>
              <div className="ps-input-wrap">
                <span className="ps-icon">✉️</span>
                <input
                  className="ps-input"
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>
              <p className="ps-hint">⚡ A new login token is issued when email changes.</p>
            </div>

            <button type="submit" className="ps-btn ps-btn--indigo" disabled={profileLoading}>
              {profileLoading ? <><span className="ps-spinner" />Saving…</> : <>Save Profile →</>}
            </button>
          </form>
        </div>

        {/* Card 2 — Change Password */}
        <div className="ps-card">
          <div className="ps-card-hdr">
            <div className="ps-card-icon ps-card-icon--teal">🛡️</div>
            <div>
              <div className="ps-card-title">Change Password</div>
              <div className="ps-card-sub">Keep your account secure</div>
            </div>
          </div>

          <Alert type={passwordStatus.type} message={passwordStatus.message} />

          <form onSubmit={handlePasswordSubmit} noValidate>
            <PasswordInput
              label="Current Password"
              name="oldPassword"
              value={passwords.oldPassword}
              onChange={e => setPW(p => ({ ...p, oldPassword: e.target.value }))}
              placeholder="Your current password"
            />

            <PasswordInput
              label="New Password"
              name="newPassword"
              value={passwords.newPassword}
              onChange={e => {
                setPW(p => ({ ...p, newPassword: e.target.value }));
                setStrength(getPasswordStrength(e.target.value));
              }}
              placeholder="Min. 6 characters"
            />

            {passwords.newPassword && strength && (
              <div className="ps-strength">
                <div className="ps-strength-track">
                  <div className="ps-strength-fill"
                    style={{ width: strength.width, background: strength.color }} />
                </div>
                <div className="ps-strength-meta">
                  <span style={{ color: strength.color }}>{strength.label}</span>
                  <span className="ps-hint" style={{ margin: 0 }}>
                    {strength.score < 3 ? 'Add uppercase, numbers, symbols' : 'Looking good!'}
                  </span>
                </div>
              </div>
            )}

            <PasswordInput
              label="Confirm New Password"
              name="confirmPassword"
              value={passwords.confirmPassword}
              onChange={e => setPW(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Re-enter new password"
            />

            {passwords.confirmPassword && (
              <p className="ps-match" style={{
                color: passwords.newPassword === passwords.confirmPassword ? '#4ade80' : '#f87171'
              }}>
                {passwords.newPassword === passwords.confirmPassword
                  ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}

            <button type="submit" className="ps-btn ps-btn--teal" disabled={passwordLoading}>
              {passwordLoading ? <><span className="ps-spinner" />Updating…</> : <>🛡️ Change Password</>}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}