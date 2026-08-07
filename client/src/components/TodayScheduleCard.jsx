import { useState, useMemo, useEffect } from 'react';
import { CalendarDays, Clock, Check, X } from 'lucide-react';

export default function TodayScheduleCard({ todayClasses, existingRecords, onQuickMark }) {
  const todayDate = new Date();
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const isoDate = todayDate.toLocaleDateString('en-CA');

  const displayClasses = todayClasses || [];
  const moreCount = 0;
  const [markingSlots, setMarkingSlots] = useState({});
  const [optimisticMarks, setOptimisticMarks] = useState({});

  // Slot-aware status: matches records to slots positionally.
  // First occurrence of subject → first record, second → second record.
  // Works correctly as long as records are created in chronological order.
  const todayRecordsBySubject = useMemo(() => {
    const map = {};
    (existingRecords || [])
      .filter(r => new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'UTC' }) === isoDate)
      .forEach(r => {
        const key = r.subjectId || r.code;
        if (!map[key]) map[key] = [];
        // Sort by slot identifier so slot_0 is always index 0
        map[key].push(r);
        map[key].sort((a, b) => {
          if (!a.slot && !b.slot) return 0;
          if (!a.slot) return 1;
          if (!b.slot) return -1;
          return a.slot.localeCompare(b.slot);
        });
      });
    return map;
  }, [existingRecords, isoDate]);

  const handleMark = async (subjectId, status, slotIndex, currentStatus) => {
    const key = `${subjectId}_${slotIndex}`;
    if (markingSlots[key]) return;

    // If clicking the already-active button → deselect (delete the record)
    const isDeselect = currentStatus === status;
    const optimisticStatus = isDeselect ? null : status;

    setOptimisticMarks(p => ({ ...p, [key]: optimisticStatus }));
    setMarkingSlots(p => ({ ...p, [key]: true }));

    try {
      await onQuickMark(subjectId, isoDate, isDeselect ? 'delete' : status, `slot_${slotIndex}`);
    } catch {
      // Revert optimistic mark on error
      setOptimisticMarks(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    } finally {
      setMarkingSlots(p => ({ ...p, [key]: false }));
    }
  };

  // Clear optimistic marks when real records come in
  useEffect(() => {
    setOptimisticMarks(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const [subjectId, slotIndexStr] = key.split('_');
        const slotIndex = parseInt(slotIndexStr, 10);
        const subjectRecs = (existingRecords || [])
          .filter(r =>
            (r.subjectId === subjectId || r.code === subjectId) &&
            new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'UTC' }) === isoDate
          )
          .sort((a, b) => {
            if (!a.slot && !b.slot) return 0;
            if (!a.slot) return 1;
            if (!b.slot) return -1;
            return a.slot.localeCompare(b.slot);
          });
        if (subjectRecs[slotIndex]) {
          delete next[key]; // real record exists, remove optimistic
        }
      });
      return next;
    });
  }, [existingRecords]);

  return (
    <div style={{
      background: 'var(--color-surface-2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .ts-card-inner { padding: 14px !important; }
        }
        .ts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
        .ts-header-left { display: flex; align-items: center; gap: 8px; }
        .ts-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); }
        .ts-header-title { font-size: 13.5px; font-weight: 700; color: var(--color-text-primary); }
        .ts-date-badge { font-size: 11px; padding: 4px 10px; background: var(--color-accent-muted); color: var(--color-accent); border-radius: var(--radius-pill); font-weight: 600; white-space: nowrap; }
        .ts-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; }
        .ts-empty-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--color-accent-muted); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .ts-empty-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; }
        .ts-empty-sub { font-size: 12px; color: var(--color-text-tertiary); }
        .ts-class-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 8px; }
        .ts-class-row:last-child { border-bottom: none; }
        .ts-time-col { width: 54px; flex-shrink: 0; }
        .ts-time { font-size: 11px; color: var(--color-text-tertiary); font-weight: 500; }
        .ts-slot { font-size: 10px; color: var(--color-text-tertiary); margin-top: 2px; }
        .ts-subject-col { flex: 1; min-width: 0; overflow: hidden; }
        .ts-subject-name { font-size: 13px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ts-code-badge { font-family: monospace; font-size: 10px; background: var(--color-surface-3); padding: 2px 6px; border-radius: 4px; color: var(--color-text-secondary); }
        .ts-action-col { flex-shrink: 0; display: flex; gap: 6px; }
        .ts-status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; }
        .ts-status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .ts-toggle-btn { width: 32px; height: 32px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1); background: var(--color-surface-3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; font-size: 10px; font-weight: 700; color: var(--color-text-tertiary); flex-shrink: 0; }
        .ts-toggle-btn:hover { background: var(--color-surface-1); }
        .ts-toggle-btn.ts-present { background: var(--color-success-muted); border-color: var(--color-success); color: var(--color-success); }
        .ts-toggle-btn.ts-absent { background: var(--color-danger-muted); border-color: var(--color-danger); color: var(--color-danger); }
        .ts-more-chip { font-size: 11px; color: var(--color-accent); background: var(--color-accent-muted); padding: 4px 10px; border-radius: var(--radius-pill); font-weight: 600; text-align: center; margin-top: 8px; }
      `}</style>

      {/* Header */}
      <div className="ts-header">
        <div className="ts-header-left">
          <div className="ts-dot" />
          <CalendarDays size={14} color="var(--color-accent)" strokeWidth={2} />
          <span className="ts-header-title">Today's schedule</span>
        </div>
        <span className="ts-date-badge">{dateStr}</span>
      </div>

      {/* Empty state */}
      {displayClasses.length === 0 ? (
        <div className="ts-empty">
          <div className="ts-empty-icon">
            <CalendarDays size={24} color="var(--color-accent)" strokeWidth={2} />
          </div>
          <div className="ts-empty-title">No classes today</div>
          <div className="ts-empty-sub">Enjoy your free day</div>
        </div>
      ) : (
        <>
          {/* Class rows */}
          {(() => {
            const subjectSlotCounter = {};
            return displayClasses.map((cls, idx) => {
              const key = cls.subjectId || cls.code;
              if (!subjectSlotCounter[key]) subjectSlotCounter[key] = 0;
              const slotIndex = subjectSlotCounter[key];
              subjectSlotCounter[key]++;
              const subjectRecords = todayRecordsBySubject[key] || [];
              const status = subjectRecords[slotIndex]?.status || null;
              const effectiveStatus = optimisticMarks[`${cls.subjectId}_${slotIndex}`] !== undefined
                  ? optimisticMarks[`${cls.subjectId}_${slotIndex}`]
                  : status;
              return (
                <div key={idx} className="ts-class-row">
                  <div className="ts-time-col">
                    <div className="ts-time">{cls.time}</div>
                    <div className="ts-slot">{cls.slot}</div>
                  </div>
                  <div className="ts-subject-col">
                    <div className="ts-subject-name">{cls.name}</div>
                    {cls.code && <span className="ts-code-badge">{cls.code}</span>}
                  </div>
                  <div className="ts-action-col">
                    <>
                      <button
                        className={`ts-toggle-btn ts-present`}
                        onClick={() => handleMark(cls.subjectId, 'present', slotIndex, effectiveStatus)}
                        title={effectiveStatus === 'present' ? 'Unmark present' : 'Mark present'}
                        disabled={!!markingSlots[`${cls.subjectId}_${slotIndex}`]}
                        style={{
                          opacity: markingSlots[`${cls.subjectId}_${slotIndex}`] ? 0.5 : 1,
                          cursor: markingSlots[`${cls.subjectId}_${slotIndex}`] ? 'not-allowed' : 'pointer',
                          ...(effectiveStatus === 'present' ? {
                            background: 'var(--color-success)',
                            borderColor: 'var(--color-success)',
                            color: 'white'
                          } : {})
                        }}
                      >
                        <Check size={12} strokeWidth={2.5} />
                      </button>
                      <button
                        className={`ts-toggle-btn ts-absent`}
                        onClick={() => handleMark(cls.subjectId, 'absent', slotIndex, effectiveStatus)}
                        title={effectiveStatus === 'absent' ? 'Unmark absent' : 'Mark absent'}
                        disabled={!!markingSlots[`${cls.subjectId}_${slotIndex}`]}
                        style={{
                          opacity: markingSlots[`${cls.subjectId}_${slotIndex}`] ? 0.5 : 1,
                          cursor: markingSlots[`${cls.subjectId}_${slotIndex}`] ? 'not-allowed' : 'pointer',
                          ...(effectiveStatus === 'absent' ? {
                            background: 'var(--color-danger)',
                            borderColor: 'var(--color-danger)',
                            color: 'white'
                          } : {})
                        }}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </>
                  </div>
                </div>
              );
            });
          })()}
        </>
      )}
    </div>
  );
}
