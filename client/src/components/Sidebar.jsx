import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Calendar, CheckSquare, BarChart3, Rocket, Clock, User, Bot, LineChart, Users, ChevronLeft, ChevronRight, LogOut, GraduationCap, Menu, X } from 'lucide-react';

const baseLinks = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/timetable',    label: 'Timetable',    icon: Calendar },
  { to: '/attendance',   label: 'Attendance',   icon: CheckSquare },
  { to: '/marks',        label: 'Marks & Ranking', icon: BarChart3 },
  { to: '/career',       label: 'Career',       icon: Rocket },
  { to: '/scheduler',    label: 'Scheduler',    icon: Clock },
  { to: '/profile',      label: 'Profile',      icon: User },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { to: '/prediction',   label: 'Predictor',    icon: LineChart },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [open, setOpen] = useState(false); // Mobile sidebar drawer open state

  const links = user?.role === 'teacher'
    ? [...baseLinks, { to: '/admin', label: 'User Management', icon: Users }]
    : baseLinks;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) setOpen(false);
  };

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const onResize = () => { 
      if (window.innerWidth > 768) setOpen(false); 
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Synchronize layout class with collapsible state
  useEffect(() => {
    const layout = document.querySelector('.layout');
    if (layout) {
      if (collapsed) {
        layout.classList.add('sidebar-collapsed');
      } else {
        layout.classList.remove('sidebar-collapsed');
      }
    }
  }, [collapsed]);

  return (
    <>
      <nav className="mobile-navbar">
        <span className="mobile-nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GraduationCap size={18} color="var(--color-accent)" />
          StudentAI
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={logout}
            style={{
              background: 'rgba(248, 113, 113, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--danger, var(--color-danger))',
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Logout"
          >
            <LogOut size={14} />
            <span style={{ fontSize: 11 }}>Logout</span>
          </button>
          <button
            className="mobile-menu-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            style={{ margin: 0 }}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
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
        {/* Logo Monogram & Text */}
        <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sidebar-logo-mark">S</div>
            {!collapsed && <span className="sidebar-logo-text">StudentAI</span>}
          </div>
          {!collapsed && (
            <button className="sidebar-toggle-btn" onClick={toggleCollapse}>
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {collapsed && (
          <button className="sidebar-toggle-btn" onClick={toggleCollapse} style={{ margin: '0 auto 16px' }}>
            <ChevronRight size={16} />
          </button>
        )}

        {!collapsed && <div className="sidebar-section-label">Navigation</div>}

        {links.map(l => {
          const IconComponent = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={handleLinkClick}
              title={collapsed ? l.label : undefined}
            >
              <span className="sidebar-link-icon">
                <IconComponent size={18} />
              </span>
              {!collapsed && <span>{l.label}</span>}
            </NavLink>
          );
        })}

        {/* User profile block at bottom */}
        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12 }}>
            <div className="sidebar-user-avatar">
              {initials}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-email">{user?.email}</div>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                style={{
                  background: 'rgba(248, 113, 113, 0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--danger, var(--color-danger))',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={logout}
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--danger, var(--color-danger))',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginTop: 8,
                width: '100%',
              }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}