// src/pages/AdminPanel.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { Lock, Users, GraduationCap, UserCheck, ListTodo } from 'lucide-react';

const API = process.env.REACT_APP_API_URL.replace(/\/api$/, '');

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [updating, setUpdating] = useState(null);

  // ── Guard ────────────────────────────────────────────────────────────────
  if (user?.role !== 'teacher') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Lock size={32} style={{ color: 'var(--color-accent)' }} />
        <p style={{ fontWeight: 600 }}>Access denied — teachers only.</p>
      </div>
    );
  }

  // ── Fetch users ──────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => { fetchUsers(); }, [user]);

  // ── Change role ──────────────────────────────────────────────────────────
  const changeRole = async (userId, newRole) => {
    setUpdating(userId);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/api/admin/users/${userId}/role`, {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`${data.user.name} is now a ${newRole}`);
      setUsers(prev =>
        prev.map(u => u._id === userId ? { ...u, role: newRole } : u)
      );
    } catch (err) {
      toast.error(err.message || 'Failed to update role.');
    } finally {
      setUpdating(null);
    }
  };

  // ── Filter + search ──────────────────────────────────────────────────────
  const visible = users.filter(u => {
    const matchesRole   = filter === 'all' || u.role === filter;
    const matchesSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.sid || '').toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const teacherCount = users.filter(u => u.role === 'teacher').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  if (user?.role !== 'teacher') return (
    <div className="card" style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Lock size={32} style={{ color: 'var(--color-accent)' }} />
      <p style={{ fontWeight: 600 }}>Access denied — teachers only.</p>
    </div>
  );

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Assign and manage student / teacher roles</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-4">
        <StatCard icon={<Users size={16} />} value={users.length}   label="Total Users"  color="var(--primary)" />
        <StatCard icon={<GraduationCap size={16} />} value={studentCount}   label="Students"     color="var(--success)" />
        <StatCard icon={<UserCheck size={16} />} value={teacherCount} label="Teachers"     color="var(--warning)" />
        <StatCard icon={<ListTodo size={16} />} value={visible.length} label="Showing"      color="var(--primary)" />
      </div>

      {/* Search + filter */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Search by name, email or SID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {['all', 'student', 'teacher'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
                background: filter === f ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                color: filter === f ? 'var(--color-text-primary)' : 'var(--text-2)',
                textTransform: 'capitalize',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {f === 'all' ? 'All' : f === 'student' ? (
                <>
                  <GraduationCap size={14} />
                  Students
                </>
              ) : (
                <>
                  <UserCheck size={14} />
                  Teachers
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="card">
        {visible.length === 0 ? (
          <EmptyState
            title="No users found"
            subtitle="Try a different search query or filter to locate users."
          />
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['User', 'SID', 'Branch / Sem', 'Current Role', 'Change Role'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid var(--card-border)' }}>

                    {/* User info */}
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                    </td>

                    {/* SID */}
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {u.sid || '—'}
                      </span>
                    </td>

                    {/* Branch / Sem */}
                    <td style={tdStyle}>
                      <div>{u.branch || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {u.semester ? `Sem ${u.semester}` : ''}
                      </div>
                    </td>

                    {/* Current role badge */}
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: u.role === 'teacher'
                          ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
                        color: u.role === 'teacher' ? 'var(--color-warning)' : 'var(--color-success)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {u.role === 'teacher' ? (
                          <>
                            <UserCheck size={12} />
                            Teacher
                          </>
                        ) : (
                          <>
                            <GraduationCap size={12} />
                            Student
                          </>
                        )}
                      </span>
                    </td>

                    {/* Toggle button */}
                    <td style={tdStyle}>
                      {u._id === user?._id ? (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>You</span>
                      ) : (
                        <button
                          disabled={updating === u._id}
                          onClick={() => changeRole(u._id, u.role === 'teacher' ? 'student' : 'teacher')}
                          style={{
                            padding: '5px 14px',
                            borderRadius: 6,
                            border: 'none',
                            cursor: updating === u._id ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                            opacity: updating === u._id ? 0.5 : 1,
                            background: u.role === 'teacher'
                              ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                            color: u.role === 'teacher' ? 'var(--color-success)' : 'var(--color-warning)',
                          }}
                        >
                          {updating === u._id
                            ? '…'
                            : u.role === 'teacher'
                            ? 'Make Student'
                            : 'Make Teacher'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div className="card stat-card">
      <span className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</span>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const thStyle = {
  padding: '10px 12px', textAlign: 'left',
  color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '10px 12px', verticalAlign: 'middle',
};