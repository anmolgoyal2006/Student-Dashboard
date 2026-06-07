import { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MonthlyCalendarCard({ records }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });
  const year = currentMonth.getFullYear();

  const calendarData = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    // getDay() returns 0=Sun...6=Sat, but grid is Mon-first
    // shift so Mon=0, Tue=1... Sun=6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return { days, firstDay, lastDay };
  }, [currentMonth]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set();
    records?.forEach(r => {
      if (r.subject) subjects.add(r.subject);
    });
    return Array.from(subjects).sort();
  }, [records]);

  const getDayStatus = (day) => {
    if (!day) return null;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    let dayRecords = records?.filter(r => {
      // Normalize date comparison - handle different date formats
      const recordDate = new Date(r.date);
      const checkDate = new Date(dateStr);
      return recordDate.toDateString() === checkDate.toDateString();
    }) || [];
    
    // Filter by selected subject if one is selected
    if (selectedSubject) {
      dayRecords = dayRecords.filter(r => r.subject === selectedSubject);
    }
    
    if (dayRecords.length === 0) return 'no-class';

    const hasPresent = dayRecords.some(r => r.status === 'present');
    const hasAbsent = dayRecords.some(r => r.status === 'absent');

    if (hasPresent && !hasAbsent) return 'present';
    if (hasAbsent && !hasPresent) return 'absent';
    return 'mixed';
  };

  const isToday = (day) => {
    if (!day) return false;
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isFuture = (day) => {
    if (!day) return false;
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return checkDate > today;
  };

  const handlePrevMonth = () => setMonthOffset(o => o - 1);
  const handleNextMonth = () => setMonthOffset(o => o + 1);

  return (
    <div style={{
      background: 'var(--color-surface-2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
    }}>
      <style>{`
        .mc-header { display: flex; align-items: center; gap: 8px; margin-bottom: var(--space-4); }
        .mc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); }
        .mc-header-title { font-size: 13.5px; font-weight: 700; color: var(--color-text-primary); }
        .mc-sub-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
        .mc-month-label { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
        .mc-nav-btn { width: 26px; height: 26px; border-radius: var(--radius-md); background: var(--color-surface-3); border: 1px solid rgba(255,255,255,0.07); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .mc-nav-btn:hover { background: var(--color-surface-1); border-color: rgba(255,255,255,0.15); }
        .mc-subject-filter { display: flex; gap: 8px; overflow-x: auto; margin-bottom: var(--space-3); scrollbar-width: none; -ms-overflow-style: none; }
        .mc-subject-filter::-webkit-scrollbar { display: none; }
        .mc-subject-chip { flex-shrink: 0; font-size: 11px; padding: 4px 10px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .mc-subject-chip.unselected { background: var(--color-surface-3); border: 1px solid rgba(255,255,255,0.07); color: var(--color-text-tertiary); }
        .mc-subject-chip.selected { background: var(--color-accent-muted); border: 1px solid rgba(99,102,241,0.28); color: var(--color-accent); font-weight: 600; }
        .mc-subject-chip:hover:not(.selected) { background: var(--color-surface-1); border-color: rgba(255,255,255,0.12); }
        .mc-legend { display: flex; gap: 16px; margin-bottom: var(--space-3); }
        .mc-legend-item { display: flex; align-items: center; gap: 6px; }
        .mc-legend-dot { width: 6px; height: 6px; border-radius: 50%; }
        .mc-legend-label { font-size: 11px; color: var(--color-text-secondary); font-weight: 500; }
        .mc-calendar-grid { display: grid; grid-template-columns: repeat(7, 30px); gap: 4px; justify-content: center; }
        .mc-day-header { font-size: 10px; color: var(--color-text-tertiary); text-align: center; text-transform: uppercase; font-weight: 600; padding-bottom: 4px; }
        .mc-day-cell { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: var(--radius-sm); cursor: default; transition: all 0.15s ease; }
        .mc-day-cell.mc-present { background: var(--color-success-muted); color: var(--color-success); }
        .mc-day-cell.mc-absent { background: var(--color-danger-muted); color: var(--color-danger); }
        .mc-day-cell.mc-mixed { background: var(--color-warning-muted); color: var(--color-warning); }
        .mc-day-cell.mc-no-class { color: var(--color-text-tertiary); }
        .mc-day-cell.mc-today { outline: 2px solid var(--color-accent); outline-offset: 1px; }
        .mc-day-cell.mc-future { opacity: 0.35; }
        .mc-day-cell:hover:not(.mc-future):not(.mc-no-class) { filter: brightness(1.1); }
      `}</style>

      {/* Header */}
      <div className="mc-header">
        <div className="mc-dot" />
        <CalendarDays size={14} color="var(--color-accent)" strokeWidth={2} />
        <span className="mc-header-title">Monthly overview</span>
      </div>

      {/* Sub-header with month navigation */}
      <div className="mc-sub-header">
        <span className="mc-month-label">{monthName} {year}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="mc-nav-btn" onClick={handlePrevMonth} title="Previous month">
            <ChevronLeft size={14} color="var(--color-text-secondary)" strokeWidth={2.5} />
          </button>
          <button className="mc-nav-btn" onClick={handleNextMonth} title="Next month">
            <ChevronRight size={14} color="var(--color-text-secondary)" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Subject filter row */}
      <div className="mc-subject-filter">
        <button
          className={`mc-subject-chip ${selectedSubject === null ? 'selected' : 'unselected'}`}
          onClick={() => setSelectedSubject(null)}
        >
          All subjects
        </button>
        {uniqueSubjects.map(subject => (
          <button
            key={subject}
            className={`mc-subject-chip ${selectedSubject === subject ? 'selected' : 'unselected'}`}
            onClick={() => setSelectedSubject(selectedSubject === subject ? null : subject)}
          >
            {subject}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mc-legend">
        <div className="mc-legend-item">
          <div className="mc-legend-dot" style={{ background: 'var(--color-success)' }} />
          <span className="mc-legend-label">Present</span>
        </div>
        <div className="mc-legend-item">
          <div className="mc-legend-dot" style={{ background: 'var(--color-danger)' }} />
          <span className="mc-legend-label">Absent</span>
        </div>
        <div className="mc-legend-item">
          <div className="mc-legend-dot" style={{ background: 'var(--color-warning)' }} />
          <span className="mc-legend-label">Mixed</span>
        </div>
        <div className="mc-legend-item">
          <div className="mc-legend-dot" style={{ background: 'var(--color-text-tertiary)' }} />
          <span className="mc-legend-label">No class</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="mc-calendar-grid">
        {/* Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="mc-day-header">{day}</div>
        ))}

        {/* Day cells */}
        {calendarData.days.map((day, idx) => {
          if (day === null) return <div key={idx} />;

          const status = getDayStatus(day);
          const today = isToday(day);
          const future = isFuture(day);

          return (
            <div
              key={idx}
              className={`mc-day-cell mc-${status || 'none'}${today ? ' mc-today' : ''}${future ? ' mc-future' : ''}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
