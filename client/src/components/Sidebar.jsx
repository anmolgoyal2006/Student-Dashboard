import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/',           label: 'Dashboard',  icon: '🏠' },
  { to: '/timetable',  label: 'Timetable',  icon: '📅' },
  { to: '/attendance', label: 'Attendance', icon: '✅' },
  { to: '/marks',      label: 'Marks',      icon: '📝' },
  { to: '/career',     label: 'Career',     icon: '🚀' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">StudentAI</div>

      <div className="sidebar-user">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
            flexShrink: 0, boxShadow: '0 0 12px rgba(129,140,248,0.3)'
          }}>
            {initials}
          </div>
          <div>
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
  );
}