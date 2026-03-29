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
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">🎓 StudentAI</div>
      <div style={{ padding: '0 8px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.email}</div>
      </div>
      {links.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <span>{l.icon}</span> {l.label}
        </NavLink>
      ))}
      <button className="sidebar-logout" onClick={logout}>
        <span>🚪</span> Logout
      </button>
    </aside>
  );
}
