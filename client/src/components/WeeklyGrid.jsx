import { useMemo } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00',
               '14:00','15:00','16:00','17:00','18:00'];

const ROW_HEIGHT  = 64;
const GRID_START  = 8 * 60;                 // 08:00 in minutes
const GRID_END    = GRID_START + HOURS.length * 60; // 19:00 — same visible
                                              // range as before, just now
                                              // actually usable by tall events

// 10 distinct subject colors. The hue carries identity via the tinted fill and
// the left border; the label itself stays near-white so every subject reads at
// the same contrast (13:1+) instead of each hue landing wherever it happens to.
// Tinting the text with its own hue put some subjects near 4.4:1, and one used
// a 12%-alpha token as a text colour, which rendered at 1.19:1 — invisible.
const LABEL = 'var(--color-text-primary)';
const COLORS = [
  { bg: 'rgba(99,102,241,0.18)',  border: '#818cf8', text: LABEL },
  { bg: 'rgba(20,184,166,0.18)',  border: '#2dd4bf', text: LABEL },
  { bg: 'rgba(245,158,11,0.18)',  border: '#fbbf24', text: LABEL },
  { bg: 'rgba(239,68,68,0.18)',   border: '#f87171', text: LABEL },
  { bg: 'rgba(168,85,247,0.18)',  border: '#c084fc', text: LABEL },
  { bg: 'rgba(34,197,94,0.18)',   border: '#4ade80', text: LABEL },
  { bg: 'rgba(236,72,153,0.18)',  border: '#f472b6', text: LABEL },
  { bg: 'rgba(59,130,246,0.18)',  border: '#60a5fa', text: LABEL },
  { bg: 'rgba(249,115,22,0.18)',  border: '#fb923c', text: LABEL },
  { bg: 'rgba(16,185,129,0.18)',  border: '#34d399', text: LABEL },
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
        conflicts.push(`Overlap: ${a.name} (${fmt12(a.startTime)}–${fmt12(a.endTime)}) & ${b.name} (${fmt12(b.startTime)}–${fmt12(b.endTime)}) overlap on ${a.day}`);
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

  // One flat list of positioned events per day, instead of one event per
  // hour-bucket. top/height come from actual start/end minutes so a 2-hour
  // class is twice as tall as a 1-hour one — previously every event was
  // forced into a single fixed-height cell regardless of duration, which
  // silently clipped anything longer than an hour (the label still showed
  // the correct end time; only the box height was wrong).
  const eventsByDay = useMemo(() => {
    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });

    subjects.forEach(s => {
      const color = colorMap[s._id];
      (s.schedule || []).forEach(slot => {
        if (!slot.day || !slot.startTime || !byDay[slot.day]) return;

        const startMin = toMinutes(slot.startTime);
        const rawEndMin = toMinutes(slot.endTime) || startMin + 60;
        // Clamp to the visible grid range rather than dropping or overflowing —
        // an event partly outside 08:00–19:00 still shows the portion that fits.
        const clampedStart = Math.max(startMin, GRID_START);
        const clampedEnd   = Math.min(Math.max(rawEndMin, clampedStart + 15), GRID_END);
        if (clampedStart >= GRID_END || clampedEnd <= GRID_START) return;

        byDay[slot.day].push({
          name: s.name,
          code: s.code,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          color,
          subjectId: s._id,
          top: ((clampedStart - GRID_START) / 60) * ROW_HEIGHT,
          height: ((clampedEnd - clampedStart) / 60) * ROW_HEIGHT,
        });
      });
    });
    return byDay;
  }, [subjects, colorMap]);

  const activeDays = DAYS.filter(d => eventsByDay[d]?.length > 0);
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);
  const gridHeight = HOURS.length * ROW_HEIGHT;

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
          color: 'var(--color-danger)', fontSize: 13, fontWeight: 500,
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

          {/* Time labels column */}
          <div style={{ position: 'relative', height: gridHeight }}>
            {/* Boundary label at the very bottom — hour labels above only mark
                each row's START time, so without this the grid's actual end
                time (19:00 here) has nothing printed to confirm it, and a
                tall event's bottom edge looks like it trails into nothing. */}
            <div style={{
              position: 'absolute', top: gridHeight, left: 0, right: 0,
              height: ROW_HEIGHT,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 10,
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-tertiary)',
            }}>
              {fmt12(`${Math.floor(GRID_END / 60)}:${String(GRID_END % 60).padStart(2, '0')}`)}
            </div>
            {HOURS.map((hour, hourIdx) => {
              const hMin = toMinutes(hour);
              const isCurrentHour = nowMinutes >= hMin && nowMinutes < hMin + 60 && todayName !== 'Sun';
              const isOddRow = hourIdx % 2 === 1;
              const rowBackground = isOddRow ? 'rgba(31, 35, 48, 0.4)' : 'rgba(255,255,255,0.01)';
              return (
                <div key={hour} style={{
                  position: 'absolute', top: hourIdx * ROW_HEIGHT, left: 0, right: 0,
                  height: ROW_HEIGHT,
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
                </div>
              );
            })}
          </div>

          {/* Day columns — background hour-lines + absolutely positioned events */}
          {displayDays.map(day => (
            <div key={day} className="grid-cell-container" style={{ position: 'relative', height: gridHeight }}>
              {/* Faint hour-row background/current-hour highlight, purely visual */}
              {HOURS.map((hour, hourIdx) => {
                const hMin = toMinutes(hour);
                const isCurrentHour = nowMinutes >= hMin && nowMinutes < hMin + 60 && todayName !== 'Sun';
                const isCurrent = isCurrentHour && day === todayName;
                const isOddRow = hourIdx % 2 === 1;
                const rowBackground = isOddRow ? 'rgba(31, 35, 48, 0.4)' : 'rgba(255,255,255,0.01)';
                return (
                  <div key={hour} style={{
                    position: 'absolute', top: hourIdx * ROW_HEIGHT, left: 0, right: 0,
                    height: ROW_HEIGHT,
                    borderRadius: 8,
                    background: isCurrent ? 'rgba(99,102,241,0.05)' : rowBackground,
                    border: isCurrent ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(255,255,255,0.03)',
                  }} />
                );
              })}

              {/* Empty-state plus icon only when the whole day has nothing */}
              {eventsByDay[day].length === 0 && (
                <div className="empty-cell-plus-hover" style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-accent)',
                }}>
                  <Plus size={16} />
                </div>
              )}

              {/* Events — height now driven by actual duration */}
              {eventsByDay[day].map((ev, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: ev.top + 2,
                  height: Math.max(ev.height - 4, ROW_HEIGHT - 4),
                  left: 4, right: 4,
                  borderRadius: 6,
                  background: ev.color.bg,
                  borderLeft: `3px solid ${ev.color.border}`,
                  padding: '4px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 500,
                    color: ev.color.text,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {ev.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                    {fmt12(ev.startTime)}–{fmt12(ev.endTime)}
                    {ev.room ? ` · ${ev.room}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}