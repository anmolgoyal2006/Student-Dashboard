import { useMemo } from 'react';
import { Plus } from 'lucide-react';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00',
               '14:00','15:00','16:00','17:00','18:00'];

// 10 distinct colors for subjects
const COLORS = [
  { bg: 'rgba(99,102,241,0.18)',  border: '#6366f1', text: '#818cf8'  },
  { bg: 'rgba(20,184,166,0.18)',  border: '#14b8a6', text: '#2dd4bf'  },
  { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', text: '#fbbf24'  },
  { bg: 'rgba(239,68,68,0.18)',  border: '#ef4444', text: '#f87171'  },
  { bg: 'rgba(168,85,247,0.18)', border: '#a855f7', text: '#c084fc'  },
  { bg: 'rgba(34,197,94,0.18)',  border: '#22c55e', text: '#4ade80'  },
  { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#f472b6'  },
  { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', text: '#60a5fa'  },
  { bg: 'rgba(249,115,22,0.18)', border: '#f97316', text: '#fb923c'  },
  { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#34d399'  },
];

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
};

const getConflicts = (subjects) => {
  const conflicts = [];
  const slots = [];
  subjects.forEach(s => {
    (s.schedule || []).forEach(slot => {
      slots.push({ ...slot, name: s.name, code: s.code });
    });
  });
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      if (a.day !== b.day) continue;
      const aStart = toMinutes(a.startTime), aEnd = toMinutes(a.endTime);
      const bStart = toMinutes(b.startTime), bEnd = toMinutes(b.endTime);
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push(`⚠️ Overlap: ${a.name} (${fmt12(a.startTime)}–${fmt12(a.endTime)}) & ${b.name} (${fmt12(b.startTime)}–${fmt12(b.endTime)}) overlap on ${a.day}`);
      }
    }
  }
  return [...new Set(conflicts)];
};

export default function WeeklyGrid({ subjects }) {
  const colorMap = useMemo(() => {
    const m = {};
    subjects.forEach((s, i) => { m[s._id] = COLORS[i % COLORS.length]; });
    return m;
  }, [subjects]);

  const conflicts = useMemo(() => getConflicts(subjects), [subjects]);

  const now        = new Date();
  const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayName  = dayNames[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const grid = useMemo(() => {
    const g = {};
    DAYS.forEach(d => { g[d] = {}; });
    subjects.forEach(s => {
      const color = colorMap[s._id];
      (s.schedule || []).forEach(slot => {
        if (!slot.day || !slot.startTime) return;
        const hourPrefix = slot.startTime.split(':')[0];
        const startHour = `${hourPrefix.padStart(2, '0')}:00`;
        if (!g[slot.day]) return;
        g[slot.day][startHour] = {
          name:      s.name,
          code:      s.code,
          endTime:   slot.endTime,
          startTime: slot.startTime,
          room:      slot.room,
          color,
          subjectId: s._id,
        };
      });
    });
    return g;
  }, [subjects, colorMap]);

  const activeDays = DAYS.filter(d =>
    subjects.some(s => (s.schedule || []).some(sl => sl.day === d))
  );
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  return (
    <div>
      <style>{`
        .empty-cell-plus-hover {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .grid-cell-container:hover .empty-cell-plus-hover {
          opacity: 0.3;
        }
      `}</style>

      {/* Conflict warnings */}
      {conflicts.map((c, i) => (
        <div key={i} style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#f87171', fontSize: 13, fontWeight: 500,
        }}>
          {c}
        </div>
      ))}

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `64px repeat(${displayDays.length}, 1fr)`,
          gap: 2,
          minWidth: 480,
        }}>
          {/* Header row */}
          <div style={{ height: 40 }} />
          {displayDays.map(d => (
            <div key={d} style={{
              height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
              fontSize: 13, fontWeight: 500,
              color: d === todayName ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: d === todayName ? 'var(--color-accent-muted)' : 'transparent',
              borderRadius: 8,
              border: d === todayName ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
            }}>
              {d}
              {d === todayName && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--color-accent)', marginLeft: 5,
                  display: 'inline-block',
                }} />
              )}
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map((hour, hourIdx) => {
            const hMin = toMinutes(hour);
            const isCurrentHour = nowMinutes >= hMin && nowMinutes < hMin + 60 && todayName !== 'Sun';
            const isOddRow = hourIdx % 2 === 1;
            const rowBackground = isOddRow ? 'rgba(31, 35, 48, 0.4)' : 'rgba(255,255,255,0.01)';

            return [
              /* Time label */
              <div key={`label-${hour}`} style={{
                height: 64,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 10,
                fontSize: '12px',
                fontVariantNumeric: 'tabular-nums',
                color: isCurrentHour ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                fontWeight: isCurrentHour ? 500 : 400,
                background: isCurrentHour ? 'rgba(99,102,241,0.05)' : rowBackground,
                borderLeft: isCurrentHour ? '3px solid var(--color-accent)' : 'none',
              }}>
                {fmt12(hour)}
              </div>,

              /* Day cells */
              ...displayDays.map(day => {
                const cell   = grid[day]?.[hour];
                const isCurrent = isCurrentHour && day === todayName;
                const cellBg = isCurrent && !cell
                  ? 'rgba(99,102,241,0.05)'
                  : (cell ? 'transparent' : rowBackground);

                return (
                  <div key={`${day}-${hour}`} className="grid-cell-container" style={{
                    height: 64,
                    borderRadius: 8,
                    padding: 4,
                    background: cellBg,
                    border: isCurrent && !cell
                      ? '1px solid rgba(99,102,241,0.15)'
                      : '1px solid rgba(255,255,255,0.03)',
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}>
                    {cell ? (
                      <div style={{
                        height: '100%',
                        borderRadius: 6,
                        background: cell.color.bg,
                        borderLeft: `3px solid ${cell.color.border}`,
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          fontSize: 12, fontWeight: 500,
                          color: cell.color.text,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {cell.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                          {fmt12(cell.startTime)}–{fmt12(cell.endTime)}
                          {cell.room ? ` · ${cell.room}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-cell-plus-hover" style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-accent)',
                      }}>
                        <Plus size={16} />
                      </div>
                    )}
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>
    </div>
  );
}