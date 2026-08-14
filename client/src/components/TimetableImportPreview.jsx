import { useState, useMemo } from 'react';
import { FileText, Save, AlertTriangle, Plus, X, Trash2, BookOpen } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY_SLOT = { day: 'Mon', startTime: '09:00', endTime: '10:00', room: '' };

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Mirrors the server's flagging rules so edits clear their warnings live,
// without a round-trip. The server re-validates on confirm regardless.
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');

function entryIssues(entry) {
  const issues = [];
  if (!entry.name?.trim()) issues.push('Missing subject name');
  if (entry.credits !== null && entry.credits !== '' && entry.credits !== undefined) {
    const c = Number(entry.credits);
    if (!Number.isFinite(c) || c < 1 || c > 6) issues.push('Credits must be 1-6');
  }
  if (!entry.schedule?.length) issues.push('No class times');
  (entry.schedule || []).forEach((s, i) => {
    if (!DAYS.includes(s.day)) issues.push(`Slot ${i + 1}: invalid day`);
    if (!isValidTime(s.startTime)) issues.push(`Slot ${i + 1}: invalid start time`);
    if (!isValidTime(s.endTime)) issues.push(`Slot ${i + 1}: invalid end time`);
  });
  return issues;
}

export default function TimetableImportPreview({ entries, fileName, existingSubjects, onConfirm, onCancel, saving }) {
  const [rows, setRows] = useState(() =>
    entries.map((e) => {
      const existing = existingSubjects?.find(
        (s) => s.name?.toLowerCase().trim() === e.name?.toLowerCase().trim() ||
               (s.code && e.code && s.code?.toLowerCase().trim() === e.code?.toLowerCase().trim())
      );
      return {
        ...e,
        credits: e.credits ?? '',
        schedule: e.schedule || [],
        include: true,
        resolveAction: existing ? 'merge' : 'create',
      };
    })
  );

  const selected = useMemo(() => rows.filter((r) => r.include), [rows]);
  const problemCount = useMemo(
    () => selected.filter((r) => r.resolveAction !== 'skip' && entryIssues(r).length > 0).length,
    [selected]
  );

  const patch = (i, changes) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...changes } : r)));

  const patchSlot = (i, slotIdx, field, val) =>
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const schedule = r.schedule.map((s, si) => (si === slotIdx ? { ...s, [field]: val } : s));
      return { ...r, schedule };
    }));

  const addSlot = (i) =>
    setRows((prev) => prev.map((r, idx) =>
      idx === i ? { ...r, schedule: [...r.schedule, { ...EMPTY_SLOT }] } : r));

  const removeSlot = (i, slotIdx) =>
    setRows((prev) => prev.map((r, idx) =>
      idx === i ? { ...r, schedule: r.schedule.filter((_, si) => si !== slotIdx) } : r));

  const handleConfirm = () => {
    onConfirm(selected.map(({ include, index, issues, credits, ...rest }) => ({
      ...rest,
      credits: credits === '' || credits === null ? undefined : Number(credits),
    })));
  };

  const overlaps = useMemo(() => {
    const allSlots = [];
    rows.forEach((row, rowIdx) => {
      if (!row.include || row.resolveAction === 'skip') return;
      (row.schedule || []).forEach((slot, slotIdx) => {
        allSlots.push({
          ...slot,
          rowIdx,
          slotIdx,
          subjectName: row.name,
        });
      });
    });

    const conflicts = [];
    const visited = new Set();

    for (let i = 0; i < allSlots.length; i++) {
      if (visited.has(i)) continue;
      const a = allSlots[i];
      const group = [a];

      for (let j = i + 1; j < allSlots.length; j++) {
        const b = allSlots[j];
        if (a.day !== b.day) continue;

        const aStart = toMinutes(a.startTime);
        const aEnd = toMinutes(a.endTime);
        const bStart = toMinutes(b.startTime);
        const bEnd = toMinutes(b.endTime);

        if (aStart < bEnd && bStart < aEnd) {
          // Skip parallel/combined-section slots: exact same time window in
          // different rooms. These are common in Indian university timetables
          // (e.g. SE in L407 and SC in L406 both at Thu 11:00-12:00).
          const exactSameWindow = (aStart === bStart && aEnd === bEnd);
          const differentRooms = a.room && b.room && a.room !== b.room;
          if (exactSameWindow && differentRooms) {
            continue;
          }
          group.push(b);
          visited.add(j);
        }
      }

      if (group.length > 1) {
        conflicts.push(group);
        visited.add(i);
      }
    }

    return conflicts;
  }, [rows]);

  const resolveOverlapGroup = (keepSlot, group) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        const filteredSchedule = row.schedule.filter((slot, slotIdx) => {
          const isInGroup = group.some((g) => g.rowIdx === idx && g.slotIdx === slotIdx);
          if (!isInGroup) return true;
          return keepSlot.rowIdx === idx && keepSlot.slotIdx === slotIdx;
        });
        return { ...row, schedule: filteredSchedule };
      })
    );
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={16} />
        <strong style={{ fontSize: 15 }}>Review imported timetable</strong>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Found {rows.length} subject(s) in {fileName || 'the PDF'}. Check the details below —
        nothing is saved until you confirm.
      </p>

      {/* ── Overlap conflicts resolution panel ── */}
      {overlaps.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontSize: 14 }}>
            <AlertTriangle size={16} />
            Schedule Overlaps Detected ({overlaps.length})
          </h4>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            Multiple classes are scheduled at the same time. Keep the one you want, and the other overlapping slots will be rejected:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {overlaps.map((group, groupIdx) => {
              const day = group[0].day;
              return (
                <div key={groupIdx} style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                  padding: 12,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Overlap on {day} around {fmt12(group[0].startTime)} – {fmt12(group[0].endTime)}:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.map((slot, slotIdx) => (
                      <div key={slotIdx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.01)',
                      }}>
                        <span style={{ fontSize: 12.5 }}>
                          <strong>{slot.subjectName}</strong>: {fmt12(slot.startTime)} – {fmt12(slot.endTime)} {slot.room && `(Room ${slot.room})`}
                        </span>
                        <button
                          type="button"
                          className="tt-btn-ghost"
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
                          onClick={() => resolveOverlapGroup(slot, group)}
                        >
                          Keep this slot
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {problemCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          padding: '10px 12px', borderRadius: 10, fontSize: 13,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          color: 'var(--color-warning)',
        }}>
          <AlertTriangle size={15} />
          {problemCount} subject(s) need attention. Fix them below, or untick them to skip.
        </div>
      )}

      {rows.map((row, i) => {
        const issues = entryIssues(row);
        const flagged = row.include && row.resolveAction !== 'skip' && issues.length > 0;
        
        // Find existing subject for name/code collision resolution
        const existing = existingSubjects?.find(
          (s) => s.name?.toLowerCase().trim() === row.name?.toLowerCase().trim() ||
                 (s.code && row.code && s.code?.toLowerCase().trim() === row.code?.toLowerCase().trim())
        );

        const isSkipped = row.resolveAction === 'skip';

        return (
          <div key={i} style={{
            marginBottom: 14, padding: '14px 16px', borderRadius: 11,
            background: (row.include && !isSkipped) ? 'rgba(255,255,255,0.02)' : 'transparent',
            opacity: (row.include && !isSkipped) ? 1 : 0.5,
            border: `1px solid ${flagged ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={row.include}
                onChange={(e) => patch(i, { include: e.target.checked })}
                aria-label={`Import ${row.name || 'subject'}`}
              />
              <input
                className="tt-input"
                style={{ flex: 1, fontWeight: 600 }}
                value={row.name}
                placeholder="Subject name"
                onChange={(e) => patch(i, { name: e.target.value })}
                disabled={isSkipped}
              />
              <button
                type="button"
                onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                title="Remove from import"
                style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  color: 'var(--color-danger)', borderRadius: 8, padding: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* ── Existing subject duplicate resolution area ── */}
            {row.include && existing && (
              <div style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#818cf8', marginBottom: 8 }}>
                  <BookOpen size={14} />
                  Subject already exists in your database ({existing.code || 'No Code'})
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Merge Schedules', val: 'merge', desc: 'Add new slots to existing slots' },
                    { label: 'Overwrite Existing', val: 'replace', desc: 'Fully replace existing slots with these' },
                    { label: 'Keep Existing (Skip)', val: 'skip', desc: 'Do not import this subject' },
                  ].map(opt => {
                    const active = (row.resolveAction || 'merge') === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        className="tt-btn-ghost"
                        style={{
                          padding: '4px 10px',
                          fontSize: 11.5,
                          background: active ? '#6366f1' : 'rgba(255,255,255,0.03)',
                          color: active ? '#fff' : 'var(--color-text-secondary)',
                          border: active ? '1px solid #6366f1' : '1px solid var(--border)',
                        }}
                        title={opt.desc}
                        onClick={() => patch(i, { resolveAction: opt.val })}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isSkipped && (
              <>
                <div className="tt-slot-grid" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="tt-label">Code</label>
                    <input className="tt-input" value={row.code || ''} placeholder="CS201"
                      onChange={(e) => patch(i, { code: e.target.value })} />
                  </div>
                  <div>
                    <label className="tt-label">Instructor</label>
                    <input className="tt-input" value={row.instructor || ''} placeholder="—"
                      onChange={(e) => patch(i, { instructor: e.target.value })} />
                  </div>
                  <div>
                    <label className="tt-label">Credits</label>
                    <input className="tt-input" type="number" min="1" max="6" value={row.credits}
                      placeholder="—" onChange={(e) => patch(i, { credits: e.target.value })} />
                  </div>
                </div>

                {row.schedule.map((slot, si) => (
                  <div key={si} className="tt-slot-grid" style={{ marginBottom: 8 }}>
                    <div>
                      {si === 0 && <label className="tt-label">Day</label>}
                      <select className="tt-input" value={slot.day}
                        onChange={(e) => patchSlot(i, si, 'day', e.target.value)}>
                        <option value="">—</option>
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      {si === 0 && <label className="tt-label">Start</label>}
                      <input className="tt-input" type="time" value={slot.startTime}
                        onChange={(e) => patchSlot(i, si, 'startTime', e.target.value)} />
                    </div>
                    <div>
                      {si === 0 && <label className="tt-label">End</label>}
                      <input className="tt-input" type="time" value={slot.endTime}
                        onChange={(e) => patchSlot(i, si, 'endTime', e.target.value)} />
                    </div>
                    <div>
                      {si === 0 && <label className="tt-label">Room</label>}
                      <input className="tt-input" value={slot.room || ''} placeholder="LH-101"
                        onChange={(e) => patchSlot(i, si, 'room', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeSlot(i, si)} title="Remove slot"
                      style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--color-danger)', borderRadius: 8, padding: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        alignSelf: si === 0 ? 'flex-end' : 'center',
                      }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button type="button" className="tt-btn-ghost" onClick={() => addSlot(i)}
                  style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={13} /> Add Slot
                </button>

                {flagged && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-warning)' }}>
                    {issues.map((msg) => <li key={msg}>{msg}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleConfirm}
          disabled={saving || selected.length === 0 || problemCount > 0}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {saving ? 'Importing…' : `Import ${selected.length} Subject(s)`}
          </span>
        </button>
        <button className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
