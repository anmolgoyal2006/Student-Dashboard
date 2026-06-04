// src/pages/AdminPanel.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

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
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 32 }}>🔒</p>
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
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <p style={{ fontSize: 32 }}>🔒</p>
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
        <StatCard emoji="👥" value={users.length}   label="Total Users"  color="var(--primary)" />
        <StatCard emoji="🎓" value={studentCount}   label="Students"     color="var(--success)" />
        <StatCard emoji="👨‍🏫" value={teacherCount} label="Teachers"     color="var(--warning)" />
        <StatCard emoji="📋" value={visible.length} label="Showing"      color="var(--primary)" />
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
                color: filter === f ? '#fff' : 'var(--text-2)',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All' : f === 'student' ? '🎓 Students' : '👨‍🏫 Teachers'}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="card">
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <p style={{ fontWeight: 600, color: 'var(--text-2)' }}>No users found</p>
            <p className="text-muted">Try a different search or filter.</p>
          </div>
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
                        color: u.role === 'teacher' ? '#fbbf24' : '#4ade80',
                      }}>
                        {u.role === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
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
                            color: u.role === 'teacher' ? '#4ade80' : '#fbbf24',
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
function StatCard({ emoji, value, label, color }) {
  return (
    <div className="card stat-card">
      <span className="stat-icon">{emoji}</span>
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