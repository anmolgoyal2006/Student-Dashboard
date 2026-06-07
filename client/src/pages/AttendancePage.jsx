// components/StudentAttendanceView.jsx — Premium SaaS Redesign
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart3, Clipboard, X, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Calendar, Filter, ChevronUp, ChevronDown, Search,
  BookOpen, Activity, Clock, Shield
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import useResponsive from '../utils/useResponsive';

/* ─────────────────────────────────────────────────────────────────────────── */
// DESIGN TOKENS
/* ─────────────────────────────────────────────────────────────────────────── */

const T = {
  // Backgrounds
  bg:        '#f8f7f4',
  surface:   '#ffffff',
  surfaceAlt:'#f3f2ef',
  hover:     '#f0efe9',

  // Borders
  border:    '#e8e6e0',
  borderMed: '#d4d1c9',

  // Typography
  ink:       '#1a1916',
  inkSub:    '#4a4844',
  inkMute:   '#8a8780',
  inkDim:    '#b0ada6',

  // Semantic
  emerald:   '#059669',
  emeraldBg: '#ecfdf5',
  emeraldBd: '#a7f3d0',

  crimson:   '#dc2626',
  crimsonBg: '#fef2f2',
  crimsonBd: '#fecaca',

  amber:     '#d97706',
  amberBg:   '#fffbeb',
  amberBd:   '#fde68a',

  indigo:    '#4f46e5',
  indigoBg:  '#eef2ff',
  indigoBd:  '#c7d2fe',

  // Accents
  accent:    '#1a1916',
  accentSub: '#4a4844',
};

const THRESHOLD = 75;

const STATUS = {
  present:   { bg: T.emeraldBg, border: T.emeraldBd, color: T.emerald,  dot: '#10b981', label: 'Present'   },
  absent:    { bg: T.crimsonBg, border: T.crimsonBd, color: T.crimson,  dot: '#ef4444', label: 'Absent'    },
  cancelled: { bg: T.amberBg,   border: T.amberBd,   color: T.amber,    dot: '#f59e0b', label: 'Cancelled' },
};

/* ─────────────────────────────────────────────────────────────────────────── */
// HELPERS
/* ─────────────────────────────────────────────────────────────────────────── */

const pctColor  = p => p >= THRESHOLD ? T.emerald  : p >= 50 ? T.amber  : T.crimson;
const pctBg     = p => p >= THRESHOLD ? T.emeraldBg: p >= 50 ? T.amberBg: T.crimsonBg;
const pctBorder = p => p >= THRESHOLD ? T.emeraldBd: p >= 50 ? T.amberBd: T.crimsonBd;
const pctLight  = p => p >= THRESHOLD ? '#34d399'  : p >= 50 ? '#fbbf24': '#f87171';

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
});

/* ─────────────────────────────────────────────────────────────────────────── */
// STAT CARD
/* ─────────────────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, bg, border }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? bg : T.surface,
        border: `1.5px solid ${hov ? border : T.border}`,
        borderRadius: 16,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={color} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: T.inkMute, marginTop: 5, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// CIRCULAR PROGRESS
/* ─────────────────────────────────────────────────────────────────────────── */

function RingProgress({ percentage }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percentage / 100) * circ;
  const color = pctColor(percentage);

  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke={T.surfaceAlt} strokeWidth="8" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {percentage}%
        </span>
        <span style={{ fontSize: 10, color: T.inkMute, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          overall
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// PROGRESS BAR
/* ─────────────────────────────────────────────────────────────────────────── */

function ProgressBar({ percentage, showThreshold }) {
  const color = pctColor(percentage);
  const colorLight = pctLight(percentage);
  const isRisk = percentage < THRESHOLD;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: T.inkSub, fontWeight: 500 }}>Overall attendance</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showThreshold && (
            isRisk
              ? <TrendingDown size={13} color={T.crimson} strokeWidth={2} />
              : <TrendingUp size={13} color={T.emerald} strokeWidth={2} />
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
            {percentage}%
          </span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: T.surfaceAlt, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <div style={{
          height: '100%', width: `${percentage}%`,
          background: `linear-gradient(90deg, ${color}, ${colorLight})`,
          borderRadius: 99,
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      {showThreshold && (
        <div style={{ fontSize: 11, color: T.inkDim, marginTop: 5, textAlign: 'right' }}>
          Minimum required: {THRESHOLD}%
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// SUBJECT ROW
/* ─────────────────────────────────────────────────────────────────────────── */

function SubjectRow({ subject, code, present, total, percentage }) {
  const [hov, setHov] = useState(false);
  const color = pctColor(percentage);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: hov ? T.hover : 'transparent',
        border: `1px solid ${hov ? T.borderMed : 'transparent'}`,
        transition: 'all 0.15s ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{subject}</span>
          {code && (
            <span style={{
              fontSize: 10, color: T.inkMute, background: T.surfaceAlt,
              border: `1px solid ${T.border}`, borderRadius: 5,
              padding: '2px 7px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em',
            }}>
              {code}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: T.inkMute, fontVariantNumeric: 'tabular-nums' }}>{present}/{total} classes</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            background: pctBg(percentage),
            color,
            border: `1px solid ${pctBorder(percentage)}`,
            borderRadius: 99,
            padding: '3px 10px',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 52,
            textAlign: 'center',
          }}>
            {percentage}%
          </span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: T.surfaceAlt, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${percentage}%`,
          background: color, borderRadius: 99,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// AT-RISK BANNER
/* ─────────────────────────────────────────────────────────────────────────── */

function AtRiskBanner({ subjects }) {
  if (!subjects?.length) return null;
  return (
    <div style={{
      background: T.amberBg, border: `1px solid ${T.amberBd}`,
      borderRadius: 14, padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
    }}>
      <AlertTriangle size={18} color={T.amber} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: T.inkSub }}>
          {subjects.length} subject{subjects.length > 1 ? 's' : ''} below {THRESHOLD}% attendance
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {subjects.map((s, i) => (
            <span key={i} style={{
              fontSize: 12, fontWeight: 600,
              background: T.crimsonBg, color: T.crimson,
              border: `1px solid ${T.crimsonBd}`,
              borderRadius: 99, padding: '2px 10px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.subject} · {s.percentage}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// RECORDS TABLE
/* ─────────────────────────────────────────────────────────────────────────── */

function RecordsTable({ records, filter, search, sortDir, onSortChange, onFilterChange, onSearchChange }) {
  const filtered = useMemo(() => {
    if (!records) return [];
    return records
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => !search || r.subject?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const diff = new Date(a.date) - new Date(b.date);
        return sortDir === 'desc' ? -diff : diff;
      });
  }, [records, filter, search, sortDir]);

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 20, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clipboard size={16} color={T.inkMute} strokeWidth={2} />
          <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Attendance records</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: T.inkMute,
            background: T.surfaceAlt, border: `1px solid ${T.border}`,
            borderRadius: 99, padding: '2px 9px', fontVariantNumeric: 'tabular-nums',
          }}>
            {filtered.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'present', 'absent', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => onFilterChange(s)}
              style={{
                padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: filter === s
                  ? s === 'all' ? T.ink : pctBg(s === 'present' ? 100 : s === 'cancelled' ? 60 : 0)
                  : 'transparent',
                color: filter === s
                  ? s === 'all' ? '#fff' : pctColor(s === 'present' ? 100 : s === 'cancelled' ? 60 : 0)
                  : T.inkMute,
                borderColor: filter === s
                  ? s === 'all' ? T.ink : pctBorder(s === 'present' ? 100 : s === 'cancelled' ? 60 : 0)
                  : T.border,
                transition: 'all 0.15s ease',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${T.border}`, position: 'relative' }}>
        <Search size={14} color={T.inkDim} style={{ position: 'absolute', left: 38, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search subjects…"
          style={{
            width: '100%', padding: '9px 14px 9px 36px',
            background: T.surfaceAlt, border: `1px solid ${T.border}`,
            borderRadius: 10, fontSize: 13, color: T.ink,
            outline: 'none', boxSizing: 'border-box', fontWeight: 500,
          }}
          onFocus={e => { e.target.style.borderColor = T.borderMed; e.target.style.background = T.surface; }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.background = T.surfaceAlt; }}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.surfaceAlt }}>
              <th style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}` }}>
                <button
                  onClick={onSortChange}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, color: T.inkMute,
                    textTransform: 'uppercase', letterSpacing: '0.07em', padding: 0,
                  }}
                >
                  Date
                  {sortDir === 'desc' ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronUp size={12} strokeWidth={2.5} />}
                </button>
              </th>
              <th style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}` }}>Subject</th>
              <th style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}` }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 0 }}>
                  <EmptyState
                    title="No records found"
                    subtitle={`No ${filter !== 'all' ? filter : ''} records${search ? ` matching "${search}"` : ''}.`}
                    illustration="attendance"
                  />
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const cfg = STATUS[r.status] || STATUS.absent;
                return (
                  <tr
                    key={i}
                    onMouseEnter={e => e.currentTarget.style.background = T.hover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background 0.12s ease' }}
                  >
                    <td style={{ padding: '13px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.inkSub, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDate(r.date)}
                    </td>
                    <td style={{ padding: '13px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.ink, fontWeight: 600 }}>
                      {r.subject}
                      {r.code && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, color: T.inkMute,
                          background: T.surfaceAlt, border: `1px solid ${T.border}`,
                          borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontWeight: 700,
                        }}>
                          {r.code}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '13px 24px', borderBottom: `1px solid ${T.border}` }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 11px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div style={{ padding: '12px 24px', fontSize: 12, color: T.inkDim, textAlign: 'right', borderTop: `1px solid ${T.border}` }}>
          Showing {filtered.length} of {records.length} records
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// LOADING SKELETON
/* ─────────────────────────────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[180, 260, 320].map((h, i) => (
        <div key={i} style={{
          background: '#fff', border: `1px solid ${T.border}`, borderRadius: 20,
          height: h, overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.03) 50%, transparent 100%)',
            animation: 'shimmer 1.5s infinite',
            backgroundSize: '200% 100%',
          }} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// ERROR STATE
/* ─────────────────────────────────────────────────────────────────────────── */

function ErrorState({ message }) {
  return (
    <div style={{
      maxWidth: 860, margin: '0 auto', padding: 80,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: T.crimsonBg, border: `1px solid ${T.crimsonBd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={22} color={T.crimson} strokeWidth={2} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: T.ink }}>Unable to load attendance</p>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMute }}>{message}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// SECTION CARD WRAPPER
/* ─────────────────────────────────────────────────────────────────────────── */

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 20, padding: '24px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <Icon size={15} color={T.inkMute} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
// MAIN COMPONENT
/* ─────────────────────────────────────────────────────────────────────────── */

export default function StudentAttendanceView({ sid }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const { isMobile } = useResponsive();
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!sid) return;
    (async () => {
      try {
        setLoading(true); setError('');
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/attendance/student/${sid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load attendance.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sid]);

  const stats = useMemo(() => {
    if (!data) return null;
    const present    = data.records.filter(r => r.status === 'present').length;
    const cancelled  = data.records.filter(r => r.status === 'cancelled').length;
    const absent     = data.total - present - cancelled;
    const atRisk     = data.summary.filter(s => s.percentage < THRESHOLD);
    const overallPct = data.total ? Math.round((present / data.total) * 100) : 0;
    return { present, absent, cancelled, atRisk, overallPct };
  }, [data]);

  const handleFilterChange = useCallback(f => setFilter(f), []);
  const handleSearchChange = useCallback(s => setSearch(s), []);
  const handleSortToggle   = useCallback(() => setSortDir(d => d === 'desc' ? 'asc' : 'desc'), []);

  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState message={error} />;
  if (!data || !stats) return null;

  const initials = data.student.name
    ? data.student.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── HEADER CARD ── */}
        <Card>
          {/* Student identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14, flexShrink: 0,
              background: T.indigoBg, border: `1.5px solid ${T.indigoBd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: T.indigo, letterSpacing: '-0.02em',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>
                {data.student.name}
              </div>
              <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{data.student.email}</span>
                {data.student.sid && (
                  <span style={{
                    background: T.surfaceAlt, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: '1px 8px', fontFamily: 'monospace',
                    fontSize: 11, fontWeight: 700, color: T.inkSub,
                  }}>
                    {data.student.sid}
                  </span>
                )}
              </div>
            </div>
            <RingProgress percentage={stats.overallPct} />
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 16 : 24 }}>
            <StatCard icon={Calendar}      label="Total classes"   value={data.total}          color={T.indigo}  bg={T.indigoBg}  border={T.indigoBd} />
            <StatCard icon={CheckCircle2}  label="Present"         value={stats.present}        color={T.emerald} bg={T.emeraldBg} border={T.emeraldBd} />
            <StatCard icon={X}             label="Absent"          value={stats.absent}         color={T.crimson} bg={T.crimsonBg} border={T.crimsonBd} />
            <StatCard icon={Shield}        label="At-risk subjects" value={stats.atRisk.length} color={stats.atRisk.length > 0 ? T.amber : T.inkMute} bg={T.amberBg} border={T.amberBd} />
          </div>

          {/* Overall progress bar */}
          <ProgressBar percentage={stats.overallPct} showThreshold />
        </Card>

        {/* ── AT-RISK BANNER ── */}
        <AtRiskBanner subjects={stats.atRisk} />

        {/* ── SUBJECT BREAKDOWN ── */}
        <Card>
          <SectionLabel icon={BookOpen} label="Subject breakdown" />
          {data.summary.map((s, i) => (
            <SubjectRow
              key={i}
              subject={s.subject}
              code={s.code}
              present={s.present}
              total={s.total}
              percentage={s.percentage}
            />
          ))}
        </Card>

        {/* ── RECORDS TABLE ── */}
        <RecordsTable
          records={data.records}
          filter={filter}
          search={search}
          sortDir={sortDir}
          onSortChange={handleSortToggle}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
        />

      </div>
    </div>
  );
}