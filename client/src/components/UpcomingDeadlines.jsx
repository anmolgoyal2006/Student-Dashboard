import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import API from '../api/axios';

const priorityColors = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', dot: '#ef4444', label: 'CRITICAL' },
  HIGH:     { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', dot: '#f59e0b', label: 'HIGH' },
  MEDIUM:   { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', dot: '#818cf8', label: 'MEDIUM' },
  LOW:      { bg: 'rgba(100,116,139,0.12)', text: '#64748b', dot: '#64748b', label: 'LOW' },
};

function daysUntil(date) {
  const now = new Date();
  const target = new Date(date);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

export default function UpcomingDeadlines() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/classroom/assignments')
      .then(res => setAssignments((res.data.assignments || []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#13161f', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 22px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Upcoming Deadlines</div>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  if (!assignments.length) return null;

  return (
    <div style={{
      background: '#13161f', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)', padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Calendar size={16} color="#818cf8" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Upcoming Deadlines</span>
      </div>
      {assignments.map((a, i) => {
        const pc = priorityColors[a.priority] || priorityColors.LOW;
        return (
          <div key={a.assignmentId || i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 10, marginBottom: 6,
            background: pc.bg, border: `1px solid ${pc.bg}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: pc.dot, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {a.title}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {a.courseName} · {daysUntil(a.dueDate)}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              color: pc.text, background: pc.bg, whiteSpace: 'nowrap',
            }}>
              {pc.label}
            </span>
          </div>
        );
      })}
      {assignments.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <a href="/scheduler" style={{
            fontSize: 12, color: '#818cf8', textDecoration: 'none', fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            View all <ChevronRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
