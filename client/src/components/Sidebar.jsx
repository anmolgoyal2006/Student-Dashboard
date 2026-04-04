import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Define SettingsIcon before using it ──────────────────
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83
               2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33
               1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09
               A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06
               a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15
               a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09
               A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06
               a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68
               a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09
               a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06
               a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9
               a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09
               a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

// ── All icons now use the same format (strings or JSX) ───
// Changed: Profile entry now uses '⚙️' emoji to stay
// consistent with the rest of the links array format.
// This avoids JSX-in-object-literal issues.
const links = [
  { to: '/',           label: 'Dashboard',  icon: '🏠' },
  { to: '/timetable',  label: 'Timetable',  icon: '📅' },
  { to: '/attendance', label: 'Attendance', icon: '✅' },
  { to: '/marks',      label: 'Marks',      icon: '📝' },
  { to: '/career',     label: 'Career',     icon: '🚀' },
  { to: '/scheduler',  label: 'Scheduler',  icon: '🗓️' },
  { to: '/profile',    label: 'Profile',    icon: '⚙️' },  // ← fixed
  { to: '/ai-assistant', label: 'AI Assistant', icon: '🤖' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) setOpen(false);
  };

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Mobile top navbar */}
      <nav className="mobile-navbar">
        <span className="mobile-nav-logo">🎓 StudentAI</span>
        <button
          className="mobile-menu-btn"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">StudentAI</div>

        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              flexShrink: 0, boxShadow: '0 0 12px rgba(129,140,248,0.3)',
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>

        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleLinkClick}
          >
            <span className="sidebar-link-icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}

        <button className="sidebar-logout" onClick={logout}>
          <span className="sidebar-link-icon">🚪</span>
          Logout
        </button>
      </aside>
    </>
  );
}