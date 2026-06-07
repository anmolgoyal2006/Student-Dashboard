import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import API from '../api/axios';
import toast from '../context/ToastContext';

export default function ClassroomConnect({ onSync }) {
  const [status, setStatus] = useState({ connected: false, loading: true });
  const [syncing, setSyncing] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState({});
  const [showPicker, setShowPicker] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await API.get('/classroom/status');
      setStatus({ ...res.data, loading: false });
    } catch {
      setStatus({ connected: false, loading: false });
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const handleConnect = async () => {
    try {
      const res = await API.get('/classroom/auth');
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch {
      toast.error('Failed to connect Google Classroom');
    }
  };

  const handleDisconnect = async () => {
    try {
      await API.delete('/classroom/disconnect');
      setStatus({ connected: false, loading: false });
      setCourses([]);
      setSelectedCourses({});
      setShowPicker(false);
      toast.success('Disconnected Google Classroom');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const loadCourses = async () => {
    try {
      const res = await API.get('/classroom/courses/available');
      const list = res.data.courses || [];
      setCourses(list);
      const allSelected = {};
      list.forEach(c => { allSelected[c.courseId] = true; });
      setSelectedCourses(allSelected);
      setShowPicker(true);
    } catch {
      toast.error('Failed to load courses');
    }
  };

  const handleSync = async () => {
    const selected = Object.entries(selectedCourses)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (selected.length === 0) {
      toast.error('Select at least one course');
      return;
    }

    setSyncing(true);
    try {
      const res = await API.post('/classroom/sync', { courseIds: selected });
      toast.success(`Synced! ${res.data.assignments} assignments imported`);
      setShowPicker(false);
      await checkStatus();
      if (onSync) onSync();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const toggleCourse = id => {
    setSelectedCourses(p => ({ ...p, [id]: !p[id] }));
  };

  const toggleAll = () => {
    const allSelected = Object.values(selectedCourses).every(Boolean);
    const next = {};
    courses.forEach(c => { next[c.courseId] = !allSelected; });
    setSelectedCourses(next);
  };

  if (status.loading) return null;

  const cardStyle = {
    background: '#13161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '20px 22px',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={16} color="#818cf8" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Google Classroom</span>
        </div>
        {status.connected ? (
          <CheckCircle size={18} color="#22c55e" />
        ) : (
          <XCircle size={18} color="#64748b" />
        )}
      </div>

      {status.connected ? (
        <div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>
            Connected as {status.email}
            {status.lastSync && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Last sync: {new Date(status.lastSync).toLocaleString()}
              </div>
            )}
          </div>

          {/* Course Picker */}
          {showPicker && (
            <div style={{
              marginBottom: 12, padding: 12, borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10, fontSize: 12.5, fontWeight: 600, color: '#cbd5e1',
              }}>
                <span>Select courses to import</span>
                <button
                  onClick={toggleAll}
                  style={{
                    background: 'none', border: 'none', color: '#818cf8',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >
                  {Object.values(selectedCourses).every(Boolean) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {courses.map(c => (
                  <label
                    key={c.courseId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: selectedCourses[c.courseId] ? 'rgba(99,102,241,0.1)' : 'transparent',
                      border: `1px solid ${selectedCourses[c.courseId] ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedCourses[c.courseId]}
                      onChange={() => toggleCourse(c.courseId)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.courseName}
                      </div>
                      {c.section && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>{c.section}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={handleSync} disabled={syncing}
                  style={{
                    flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 12.5,
                    cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                  {syncing ? 'Syncing...' : 'Import Selected'}
                </button>
                <button onClick={() => setShowPicker(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: '#94a3b8', fontWeight: 500, fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadCourses} disabled={syncing || showPicker}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 12.5,
                cursor: syncing || showPicker ? 'not-allowed' : 'pointer',
                opacity: syncing || showPicker ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <ChevronDown size={14} />
              Choose Courses & Sync
            </button>
            <button onClick={handleDisconnect}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#ef4444', fontWeight: 500, fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>
            Connect Google Classroom to auto-import assignments and deadlines.
          </div>
          <button onClick={handleConnect}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none',
              background: '#4285F4', color: '#fff', fontWeight: 600, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Connect Google Classroom
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}