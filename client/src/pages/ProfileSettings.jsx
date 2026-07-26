import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService, authService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { Lock, Eye, EyeOff, User, Mail, Zap, ArrowRight, Shield, ShieldOff, GraduationCap, Info, LogOut } from 'lucide-react';
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
    { label: 'Very weak',   color: 'var(--color-danger)', width: '20%'  },
    { label: 'Weak',        color: 'var(--color-warning)', width: '40%'  },
    { label: 'Fair',        color: 'var(--color-warning)', width: '60%'  },
    { label: 'Strong',      color: 'var(--color-success)', width: '80%'  },
    { label: 'Very strong', color: 'var(--color-success)', width: '100%' },
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
        <span className="ps-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={16} /></span>
        <input
          className="ps-input"
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button type="button" className="ps-eye-btn" onClick={() => setShow(s => !s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function ProfileSettings() {
  const { user, updateUser,logout} = useAuth();

  const [profile,        setProfile]   = useState({ name: user?.name || '', email: user?.email || '', state: user?.state || '' });
  const [profileStatus,  setPS]        = useState({ type: '', message: '' });
  const [profileLoading, setPL]        = useState(false);

  const [passwords,       setPW]       = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus,  setPwS]      = useState({ type: '', message: '' });
  const [passwordLoading, setPwL]      = useState(false);
  const [strength,        setStrength] = useState(null);

  const [sid,        setSid]  = useState(user?.sid || '');
  const [sidStatus,  setSidS] = useState({ type: '', message: '' });
  const [sidLoading, setSidL] = useState(false);

  const [logoutAllLoading, setLogoutAllL] = useState(false);

  const handleLogoutAll = async () => {
    if (!window.confirm('Sign out of every device? You will need to log in again everywhere.')) return;

    setLogoutAllL(true);
    try {
      await authService.logoutAll();
      toast.success('Signed out of all devices.');
      logout();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sign out of all devices.');
      setLogoutAllL(false);
    }
  };

  const handleProfileSubmit = async e => {
    e.preventDefault();
    setPS({ type: '', message: '' });

    const name  = profile.name.trim();
    const email = profile.email.trim().toLowerCase();
    const state = profile.state.trim();

    if (name && name.length < 2)
      return setPS({ type: 'error', message: 'Name must be at least 2 characters.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setPS({ type: 'error', message: 'Please enter a valid email address.' });
    if (name === user?.name && email === user?.email?.toLowerCase() && state === user?.state)
      return setPS({ type: 'error', message: 'No changes detected.' });

    setPL(true);
    try {
      const { data } = await userService.updateProfile({ name, email, state });
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

  const handleSidSubmit = async e => {
    e.preventDefault();
    setSidS({ type: '', message: '' });

    const trimmed = sid.trim();
    if (!trimmed) return setSidS({ type: 'error', message: 'SID cannot be empty.' });
    if (trimmed === user?.sid) return setSidS({ type: 'error', message: 'No changes detected.' });

    setSidL(true);
    try {
      const { data } = await userService.updateSID({ sid: trimmed });
      updateUser(data.user);
      setSidS({ type: 'success', message: data.message });
      toast.success('SID updated!');
    } catch (err) {
      setSidS({ type: 'error', message: err.response?.data?.message || 'Failed to update SID.' });
    } finally {
      setSidL(false);
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
            <div className="ps-card-icon ps-card-icon--indigo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <User size={18} />
            </div>
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
                <span className="ps-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} /></span>
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
                <span className="ps-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={16} /></span>
                <input
                  className="ps-input"
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </div>
              <p className="ps-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} style={{ color: 'var(--color-accent)' }} />
                A new login token is issued when email changes.
              </p>
            </div>

            <div className="ps-field">
              <label className="ps-label">State/Region</label>
              <div className="ps-input-wrap">
                <span className="ps-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Info size={16} /></span>
                <input
                  className="ps-input"
                  type="text"
                  value={profile.state}
                  onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}
                  placeholder="e.g., California, Maharashtra"
                />
              </div>
            </div>

            <button type="submit" className="ps-btn ps-btn--indigo" disabled={profileLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {profileLoading ? <><span className="ps-spinner" />Saving…</> : (
                <>
                  <span>Save Profile</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Card 2 — Change Password */}
        <div className="ps-card">
          <div className="ps-card-hdr">
            <div className="ps-card-icon ps-card-icon--teal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Shield size={18} />
            </div>
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
                color: passwords.newPassword === passwords.confirmPassword ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {passwords.newPassword === passwords.confirmPassword
                  ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}

            <button type="submit" className="ps-btn ps-btn--teal" disabled={passwordLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {passwordLoading ? (
                <>Updating…</>
              ) : (
                <>
                  <Shield size={14} />
                  Change Password
                </>
              )}
            </button>
          </form>
        </div>

  {/* Card 3 — Update SID */}
        <div className="ps-card">
          <div className="ps-card-hdr">
            <div className="ps-card-icon ps-card-icon--amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="ps-card-title">Student ID (SID)</div>
              <div className="ps-card-sub">Update your unique student identifier</div>
            </div>
          </div>

          <Alert type={sidStatus.type} message={sidStatus.message} />

          <form onSubmit={handleSidSubmit} noValidate>
            <div className="ps-field">
              <label className="ps-label">Student ID</label>
              <div className="ps-input-wrap">
                <span className="ps-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={16} /></span>
                <input
                  className="ps-input"
                  type="text"
                  value={sid}
                  onChange={e => setSid(e.target.value)}
                  placeholder="e.g. 2023CS001"
                />
              </div>
              <p className="ps-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info size={12} style={{ color: 'var(--color-warning)' }} />
                SID must be unique across all users.
              </p>
            </div>

            <button type="submit" className="ps-btn ps-btn--amber" disabled={sidLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {sidLoading ? (
                <>Saving…</>
              ) : (
                <>
                  <GraduationCap size={14} />
                  Update SID
                </>
              )}
            </button>
          </form>
        </div>

        {/* Card 4 — Logout */}
        <div className="ps-card">
          <div className="ps-card-hdr">
            <div className="ps-card-icon ps-card-icon--danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
              <LogOut size={18} />
            </div>
            <div>
              <div className="ps-card-title">Logout</div>
              <div className="ps-card-sub">Sign out of your account</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="ps-btn ps-btn--danger"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--color-danger)', border: 'none' }}
          >
            <LogOut size={14} />
            Logout
          </button>

          <div className="ps-alert ps-alert--info" style={{ marginTop: '14px' }}>
            <span className="ps-alert-icon"><Info size={14} /></span>
            <span>
              Lost a device, or think someone else has your account? Signing out
              everywhere immediately invalidates every existing session.
            </span>
          </div>

          <button
            onClick={handleLogoutAll}
            disabled={logoutAllLoading}
            className="ps-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
          >
            <ShieldOff size={14} />
            {logoutAllLoading ? 'Signing out…' : 'Sign out of all devices'}
          </button>
        </div>

      </div>
    </div>
  );
}