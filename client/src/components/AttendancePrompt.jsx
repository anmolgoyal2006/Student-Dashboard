// src/components/AttendancePrompt.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL;

export default function AttendancePrompt() {
  const [prompt, setPrompt] = useState(null); // { subjectId, date }
  const [marking, setMarking] = useState(null);
  const navigate = useNavigate();

 useEffect(() => {
    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('markAttendance') === '1') {
        setPrompt({
          subjectId: params.get('subjectId'),
          date:      params.get('date'),
        });
        window.history.replaceState({}, '', '/');
      }
    };

    checkParams(); // on mount

 // Listen for SW navigation on mobile
    window.addEventListener('popstate', checkParams);

    // iOS PWA: SW can't navigate directly, sends message instead
    const handleSWMessage = (event) => {
      if (event.data?.type === 'MARK_ATTENDANCE') {
        setPrompt({
          subjectId: event.data.subjectId,
          date:      event.data.date,
        });
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('popstate', checkParams);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  if (!prompt) return null;

  const mark = async (status) => {
    setMarking(status);
    try {
      const token = localStorage.getItem('token');
  const res = await fetch(`${API}/attendance/mark-from-notification`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjectId: prompt.subjectId,
          status,
          date: prompt.date,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      toast.success(`Marked as "${status.replace('_', ' ')}"`);
      setPrompt(null);
    } catch {
      toast.error('Could not mark attendance. Try again.');
    } finally {
      setMarking(null);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.icon}>🔔</div>
        <h3 style={s.title}>Mark Your Attendance</h3>
        <p style={s.sub}>Did you attend this class?</p>

        <div style={s.btnRow}>
          <button
            style={{ ...s.btn, ...s.btnPresent }}
            disabled={!!marking}
            onClick={() => mark('attended')}
          >
            {marking === 'attended' ? '…' : '✅ Attended'}
          </button>
          <button
            style={{ ...s.btn, ...s.btnAbsent }}
            disabled={!!marking}
            onClick={() => mark('not_attended')}
          >
            {marking === 'not_attended' ? '…' : '❌ Not Attended'}
          </button>
          <button
            style={{ ...s.btn, ...s.btnNeutral }}
            disabled={!!marking}
            onClick={() => mark('not_held')}
          >
            {marking === 'not_held' ? '…' : '⏸ Not Held'}
          </button>
        </div>

        <button style={s.dismiss} onClick={() => setPrompt(null)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: 'var(--card-bg, #1e1e2e)',
    border: '1px solid var(--card-border, rgba(255,255,255,0.1))',
    borderRadius: 16, padding: '32px 24px',
    textAlign: 'center', maxWidth: 340, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  icon:  { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--text, #fff)' },
  sub:   { fontSize: 14, color: 'var(--muted, #888)', margin: '0 0 24px' },
  btnRow: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  btn: {
    padding: '12px 20px', borderRadius: 10,
    border: 'none', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, width: '100%',
  },
  btnPresent: { background: 'rgba(34,197,94,0.2)',  color: '#4ade80' },
  btnAbsent:  { background: 'rgba(239,68,68,0.2)',  color: '#f87171' },
  btnNeutral: { background: 'rgba(99,102,241,0.2)', color: '#818cf8' },
  dismiss: {
    background: 'transparent', border: 'none',
    color: 'var(--muted, #888)', cursor: 'pointer',
    fontSize: 13, padding: '4px 8px',
  },
};