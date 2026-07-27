import { useState, useMemo } from 'react';
import { FileText, Save, AlertTriangle, Plus, X, Trash2 } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY_SLOT = { day: 'Mon', startTime: '09:00', endTime: '10:00', room: '' };

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

export default function TimetableImportPreview({ entries, fileName, onConfirm, onCancel, saving }) {
  const [rows, setRows] = useState(() =>
    entries.map((e) => ({
      ...e,
      credits: e.credits ?? '',
      schedule: e.schedule || [],
      include: true,
    }))
  );

  const selected = useMemo(() => rows.filter((r) => r.include), [rows]);
  const problemCount = useMemo(
    () => selected.filter((r) => entryIssues(r).length > 0).length,
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

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={16} />
        <strong style={{ fontSize: 15 }}>Review imported timetable</strong>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
        Found {rows.length} subject(s) in {fileName || 'the PDF'}. Check the details below —
        nothing is saved until you confirm.
      </p>

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
        const flagged = row.include && issues.length > 0;
        return (
          <div key={i} style={{
            marginBottom: 14, padding: '14px 16px', borderRadius: 11,
            background: row.include ? 'rgba(255,255,255,0.02)' : 'transparent',
            opacity: row.include ? 1 : 0.5,
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

            <button type="button" className="btn btn-outline" onClick={() => addSlot(i)}
              style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Slot
            </button>

            {flagged && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-warning)' }}>
                {issues.map((msg) => <li key={msg}>{msg}</li>)}
              </ul>
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
