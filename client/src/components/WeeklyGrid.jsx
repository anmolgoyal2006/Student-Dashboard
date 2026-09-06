import { useMemo } from 'react';
import { Download, Clock, BookOpen, AlertTriangle } from 'lucide-react';
import html2pdf from 'html2pdf.js';

/* ── Shared constants ─────────────────────────────────────────────────────── */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

const MATRIX_SLOTS = [
  { label: '8–9 AM',   start: 8 * 60,  end: 9 * 60,  isLunch: false },
  { label: '9–10 AM',  start: 9 * 60,  end: 10 * 60, isLunch: false },
  { label: '10–11 AM', start: 10 * 60, end: 11 * 60, isLunch: false },
  { label: '11–12 PM', start: 11 * 60, end: 12 * 60, isLunch: false },
  { label: '12–1 PM',  start: 12 * 60, end: 13 * 60, isLunch: false },
  { label: '1–2 PM',   start: 13 * 60, end: 14 * 60, isLunch: true  },
  { label: '2–3 PM',   start: 14 * 60, end: 15 * 60, isLunch: false },
  { label: '3–4 PM',   start: 15 * 60, end: 16 * 60, isLunch: false },
  { label: '4–5 PM',   start: 16 * 60, end: 17 * 60, isLunch: false },
  { label: '5–7 PM',   start: 17 * 60, end: 19 * 60, isLunch: false },
];

/* Web — rich dark saturated cards on black canvas */
const WEB_PALETTE = [
  { bg: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', border: '#818cf8', glow: 'rgba(99,102,241,0.35)' },
  { bg: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', border: '#34d399', glow: 'rgba(16,185,129,0.35)' },
  { bg: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)', border: '#fbbf24', glow: 'rgba(245,158,11,0.35)' },
  { bg: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', border: '#f87171', glow: 'rgba(239,68,68,0.35)' },
  { bg: 'linear-gradient(135deg, #581c87 0%, #9333ea 100%)', border: '#c084fc', glow: 'rgba(168,85,247,0.35)' },
  { bg: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)', border: '#38bdf8', glow: 'rgba(6,182,212,0.35)' },
  { bg: 'linear-gradient(135deg, #831843 0%, #db2777 100%)', border: '#f472b6', glow: 'rgba(236,72,153,0.35)' },
  { bg: 'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)', border: '#2dd4bf', glow: 'rgba(20,184,166,0.35)' },
];

/* PDF — white canvas, high-contrast saturated pastel fills, readable dark text */
const PDF_PALETTE = [
  { bg: '#eef2ff', border: '#c7d2fe', left: '#4f46e5', text: '#1e1b4b', code: '#3730a3', badgeBg: '#dbeafe', badgeText: '#1e3a8a' },
  { bg: '#ecfdf5', border: '#a7f3d0', left: '#059669', text: '#064e3b', code: '#065f46', badgeBg: '#cbfbee', badgeText: '#044e3a' },
  { bg: '#fffbeb', border: '#fde68a', left: '#d97706', text: '#78350f', code: '#92400e', badgeBg: '#fef08a', badgeText: '#713f12' },
  { bg: '#fff1f2', border: '#fecdd3', left: '#e11d48', text: '#881337', code: '#be123c', badgeBg: '#ffe4e6', badgeText: '#881337' },
  { bg: '#faf5ff', border: '#e9d5ff', left: '#9333ea', text: '#581c87', code: '#6b21a8', badgeBg: '#f3e8ff', badgeText: '#581c87' },
  { bg: '#ecfeff', border: '#a5f3fc', left: '#0891b2', text: '#164e63', code: '#0e7490', badgeBg: '#cffafe', badgeText: '#155e75' },
  { bg: '#fdf2f8', border: '#fbcfe8', left: '#db2777', text: '#831843', code: '#be185d', badgeBg: '#fce7f3', badgeText: '#831843' },
  { bg: '#f0fdfa', border: '#99f6e4', left: '#0d9488', text: '#134e4a', code: '#0f766e', badgeBg: '#ccfbf1', badgeText: '#115e59' },
];

const DAY_WEB = {
  Mon: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  Tue: { color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  Wed: { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
  Thu: { color: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
  Fri: { color: '#c084fc', bg: 'rgba(192,132,252,0.08)' },
  Sat: { color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)' },
};

const DAY_PDF = {
  Mon: { color: '#c2410c', bg: '#fff7ed', border: '#ea580c' },
  Tue: { color: '#15803d', bg: '#f0fdf4', border: '#16a34a' },
  Wed: { color: '#1d4ed8', bg: '#eff6ff', border: '#2563eb' },
  Thu: { color: '#be185d', bg: '#fdf2f8', border: '#db2777' },
  Fri: { color: '#7e22ce', bg: '#faf5ff', border: '#9333ea' },
  Sat: { color: '#0f766e', bg: '#f0fdfa', border: '#0d9488' },
};

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const buildEventsByDay = (subjects, colorMap) => {
  const byDay = {};
  DAYS.forEach(d => { byDay[d] = []; });
  subjects.forEach(s => {
    const color = colorMap[s._id];
    (s.schedule || []).forEach(slot => {
      if (!slot.day || !slot.startTime || !byDay[slot.day]) return;
      const startMin = toMinutes(slot.startTime);
      const endMin = toMinutes(slot.endTime) || startMin + 60;
      byDay[slot.day].push({
        name: s.name, code: s.code, instructor: s.instructor,
        room: slot.room, color, startMin, endMin,
      });
    });
  });
  return byDay;
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
        conflicts.push(`${a.name} & ${b.name} overlap on ${a.day} (${fmt12(a.startTime)}–${fmt12(a.endTime)})`);
      }
    }
  }
  return [...new Set(conflicts)];
};

const fmtShort = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mStr = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  return { text: `${h12}${mStr}`, ampm };
};

const fmtSlotLabel = (startMin, endMin) => {
  const s = fmtShort(startMin);
  const e = fmtShort(endMin);
  if (s.ampm === e.ampm) {
    return `${s.text}–${e.text} ${e.ampm}`;
  }
  return `${s.text} ${s.ampm}–${e.text} ${e.ampm}`;
};

const getDynamicMatrixSlots = (subjects) => {
  if (!subjects?.length) return MATRIX_SLOTS;

  const rawSlots = [];
  const boundaries = new Set();

  subjects.forEach(s => {
    (s.schedule || []).forEach(slot => {
      if (!slot.startTime || !slot.endTime) return;
      const start = toMinutes(slot.startTime);
      const end = toMinutes(slot.endTime);
      if (start < end) {
        boundaries.add(start);
        boundaries.add(end);
        rawSlots.push({ start, end });
      }
    });
  });

  if (boundaries.size < 2) return MATRIX_SLOTS;

  const sortedBounds = [...boundaries].sort((a, b) => a - b);
  const minStart = sortedBounds[0];
  const maxEnd = sortedBounds[sortedBounds.length - 1];

  const step = 60;
  const slots = [];
  let curr = minStart;

  while (curr < maxEnd) {
    let next = curr + step;
    const nextBound = sortedBounds.find(b => b > curr && b <= next);
    if (nextBound && nextBound < next) {
      next = nextBound;
    }

    const isBreak = !rawSlots.some(s => s.start < next && s.end > curr);
    slots.push({
      label: fmtSlotLabel(curr, next),
      start: curr,
      end: next,
      isLunch: isBreak,
    });
    curr = next;
  }

  return slots.length > 0 ? slots : MATRIX_SLOTS;
};

/* ── PDF export — clean, professional, border-refined design ─────────────── */
export function exportTimetablePDF(subjects) {
  if (!subjects?.length) return;

  const matrixSlots = getDynamicMatrixSlots(subjects);
  const colorMap = {};
  subjects.forEach((s, i) => { colorMap[s._id] = PDF_PALETTE[i % PDF_PALETTE.length]; });
  const eventsByDay = buildEventsByDay(subjects, colorMap);
  const activeDays = DAYS.filter(d => eventsByDay[d]?.length > 0);
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  let totalSessions = 0;
  subjects.forEach(s => { totalSessions += (s.schedule || []).length; });

  const CELL_H = 74;

  let rowsHtml = '';
  displayDays.forEach(day => {
    const dayTheme = DAY_PDF[day] || { color: '#334155', bg: '#f8fafc', border: '#6366f1' };
    const dayEvents = eventsByDay[day] || [];

    let cellsHtml = '';
    let sIdx = 0;

    while (sIdx < matrixSlots.length) {
      const slot = matrixSlots[sIdx];
      const matchingEvents = dayEvents.filter(ev => ev.startMin < slot.end && ev.endMin > slot.start);
      const startedEarlier = dayEvents.some(ev => ev.startMin < slot.start && ev.endMin > slot.start);

      if (startedEarlier) {
        sIdx++;
        continue;
      }

      if (matchingEvents.length > 0) {
        const maxEndMin = Math.max(...matchingEvents.map(ev => ev.endMin));
        let span = 1;
        while (sIdx + span < matrixSlots.length && matrixSlots[sIdx + span].start < maxEndMin) {
          span++;
        }

        const col = matchingEvents[0]?.color || PDF_PALETTE[0];
        const ev = matchingEvents[0];
        const formattedCode = ev.code ? ev.code.replace(/\+/g, ' + ') : '';

        cellsHtml += `
          <td colspan="${span}" style="height:${CELL_H}px;background:${col.bg};border:1px solid ${col.border};border-left:5px solid ${col.left};padding:7px 9px;vertical-align:middle;border-radius:6px;">
            <div style="display:flex;flex-direction:column;justify-content:center;height:100%;">
              <div style="font-size:11.5px;font-weight:900;color:${col.text};line-height:1.2;letter-spacing:-0.2px;">${ev.name}</div>
              ${formattedCode ? `<div style="font-size:9px;font-weight:700;color:${col.code};margin-top:2px;line-height:1.15;word-break:break-word;">(${formattedCode})</div>` : ''}
              ${ev.instructor ? `<div style="font-size:8px;font-weight:600;color:${col.text};opacity:0.85;margin-top:1px;">${ev.instructor}</div>` : ''}
              ${ev.room ? `<div style="display:inline-block;font-size:8.5px;font-weight:800;color:${col.badgeText};background:${col.badgeBg};padding:2px 7px;border-radius:4px;margin-top:3px;width:fit-content;letter-spacing:0.2px;">Room ${ev.room}</div>` : ''}
            </div>
          </td>
        `;
        sIdx += span;
      } else {
        const isLunch = slot.isLunch;
        cellsHtml += `
          <td style="height:${CELL_H}px;background:${isLunch ? '#f8fafc' : '#ffffff'};border:1px ${isLunch ? 'dashed #cbd5e1' : 'solid #f1f5f9'};padding:4px;text-align:center;vertical-align:middle;border-radius:6px;">
            ${isLunch ? '<div style="font-size:8.5px;font-weight:900;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">LUNCH</div>' : ''}
          </td>
        `;
        sIdx++;
      }
    }

    rowsHtml += `
      <tr>
        <td style="height:${CELL_H}px;background:${dayTheme.bg};border:1px solid ${dayTheme.border}55;border-left:5px solid ${dayTheme.border};color:${dayTheme.color};font-size:12px;font-weight:900;text-align:center;padding:8px 6px;border-radius:6px;vertical-align:middle;">
          ${FULL_DAYS[day]}
        </td>
        ${cellsHtml}
      </tr>`;
  });

  const thsHtml = matrixSlots.map(slot =>
    `<th style="background:${slot.isLunch ? '#f1f5f9' : '#f8fafc'};color:${slot.isLunch ? '#64748b' : '#0f172a'};border:1px solid #e2e8f0;border-top:${slot.isLunch ? '3px solid #cbd5e1' : '3px solid #6366f1'};padding:9px 3px;font-size:10px;font-weight:800;text-align:center;border-radius:6px;">${slot.label}</th>`
  ).join('');

  const legendHtml = subjects.map((s, i) => {
    const col = PDF_PALETTE[i % PDF_PALETTE.length];
    const sessionCount = (s.schedule || []).length;
    return `
      <span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;margin-bottom:4px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${col.left};display:inline-block;"></span>
        <span style="font-size:10px;font-weight:800;color:${col.text};">${s.name}</span>
        ${s.code ? `<span style="font-size:9px;font-weight:600;color:${col.code};">(${s.code})</span>` : ''}
        <span style="font-size:8px;font-weight:700;color:#64748b;background:#f1f5f9;padding:1px 5px;border-radius:10px;">${sessionCount}x/wk</span>
      </span>
    `;
  }).join('');

  const pdfContainer = document.createElement('div');
  pdfContainer.style.cssText = 'padding:20px;background:#ffffff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI,Roboto,sans-serif;width:1100px;box-sizing:border-box;';

  pdfContainer.innerHTML = `
    <!-- Top Header Bar -->
    <div style="border-bottom:3px solid #6366f1;padding-bottom:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#d946ef 100%);color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">S</div>
        <div>
          <div style="font-size:10px;font-weight:900;color:#6366f1;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:2px;">STUDENT AI · ACADEMIC MANAGEMENT</div>
          <h1 style="font-size:22px;font-weight:900;color:#0f172a;margin:0;letter-spacing:-0.5px;">Weekly Class Schedule</h1>
          <p style="font-size:10px;color:#64748b;margin:3px 0 0;font-weight:500;">${subjects.length} Enrolled Subjects · ${totalSessions} Weekly Sessions · Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="background:#eef2ff;border:1.5px solid #c7d2fe;color:#4338ca;padding:4px 14px;border-radius:20px;font-size:9.5px;font-weight:900;display:inline-block;letter-spacing:0.5px;">STUDENT AI SCHEDULE</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-weight:600;">CONFIDENTIAL & PERSONAL USE</div>
      </div>
    </div>

    <!-- Main Schedule Table -->
    <table style="width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed;">
      <thead>
        <tr>
          <th style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-top:3px solid #6366f1;padding:9px 4px;font-size:10.5px;font-weight:900;width:95px;text-align:center;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">DAY</th>
          ${thsHtml}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <!-- Subject Legend Box -->
    <div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:9px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Enrolled Subjects & Color Legend</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;">${legendHtml}</div>
    </div>

    <!-- Footer Notes -->
    <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8;padding:0 4px;font-weight:500;">
      <span>StudentAI · Academic Schedule Document Export</span>
      <span>Official Personal Schedule — Generated by StudentAI</span>
    </div>`;

  html2pdf().set({
    margin: [6, 6, 6, 6],
    filename: 'Student_Timetable.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
  }).from(pdfContainer).save();
}

/* ── Web component — black canvas, vibrant grid ──────────────────────────── */
export default function WeeklyGrid({ subjects }) {
  const matrixSlots = useMemo(() => getDynamicMatrixSlots(subjects), [subjects]);

  const colorMap = useMemo(() => {
    const m = {};
    subjects.forEach((s, i) => { m[s._id] = WEB_PALETTE[i % WEB_PALETTE.length]; });
    return m;
  }, [subjects]);

  const conflicts = useMemo(() => getConflicts(subjects), [subjects]);

  const eventsByDay = useMemo(() => buildEventsByDay(subjects, colorMap), [subjects, colorMap]);

  const activeDays = DAYS.filter(d => eventsByDay[d]?.length > 0);
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  const totalSlots = useMemo(() =>
    subjects.reduce((n, s) => n + (s.schedule?.length || 0), 0),
  [subjects]);

  const renderMatrixRowCells = (day) => {
    const dayEvents = eventsByDay[day] || [];
    const cells = [];
    let sIdx = 0;

    while (sIdx < matrixSlots.length) {
      const slot = matrixSlots[sIdx];
      const matchingEvents = dayEvents.filter(ev => ev.startMin < slot.end && ev.endMin > slot.start);
      const startedEarlier = dayEvents.some(ev => ev.startMin < slot.start && ev.endMin > slot.start);

      if (startedEarlier) {
        sIdx++;
        continue;
      }

      if (matchingEvents.length > 0) {
        const maxEndMin = Math.max(...matchingEvents.map(ev => ev.endMin));
        let span = 1;
        while (sIdx + span < matrixSlots.length && matrixSlots[sIdx + span].start < maxEndMin) {
          span++;
        }

        const ev = matchingEvents[0];
        const col = ev.color || WEB_PALETTE[0];
        const code = ev.code ? ev.code.replace(/\+/g, ' + ') : '';

        cells.push(
          <td key={sIdx} colSpan={span} className="tt-cell-filled">
            <div
              className="tt-subject-card"
              style={{
                background: col.bg,
                borderColor: col.border,
                boxShadow: `0 4px 20px ${col.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
              }}
              title={`${ev.name}${code ? ` (${code})` : ''}${ev.instructor ? ` · ${ev.instructor}` : ''}${ev.room ? ` · Room ${ev.room}` : ''}`}
            >
              <div className="tt-subject-name">{ev.name}</div>
              {code && <div className="tt-subject-code">({code})</div>}
              {ev.room && <span className="tt-subject-room">Room: {ev.room}</span>}
            </div>
          </td>
        );
        sIdx += span;
      } else {
        cells.push(
          <td key={sIdx} className={`tt-cell-empty${slot.isLunch ? ' tt-cell-lunch' : ''}`}>
            {slot.isLunch && <span className="tt-lunch-label">LUNCH</span>}
          </td>
        );
        sIdx++;
      }
    }

    return cells;
  };

  return (
    <div className="tt-root">
      <style>{`
        .tt-root { --tt-black: #000000; --tt-surface: #0a0a0a; --tt-border: rgba(255,255,255,0.08); }

        .tt-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; margin-bottom: 18px;
        }
        .tt-toolbar-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .tt-toolbar-title {
          font-size: 15px; font-weight: 700; color: #f8fafc;
          display: flex; align-items: center; gap: 8px; letter-spacing: -0.2px;
        }
        .tt-stat-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;
        }
        .tt-stat-pill strong { color: #e2e8f0; font-weight: 700; }

        .tt-pdf-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 10px; cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border: none; color: #fff; font-size: 13px; font-weight: 700;
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .tt-pdf-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(99,102,241,0.55); }

        .tt-conflict {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; border-radius: 10px; margin-bottom: 12px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; font-size: 12.5px; font-weight: 500;
        }

        .tt-legend {
          display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
          padding: 12px 14px; border-radius: 12px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
        }
        .tt-legend-item {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 4px 10px 4px 6px; border-radius: 8px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          font-size: 11.5px; font-weight: 600; color: #cbd5e1;
        }
        .tt-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

        .tt-grid-wrap {
          overflow-x: auto; border-radius: 16px;
          background: var(--tt-black);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.6);
          padding: 14px;
        }
        .tt-grid-wrap::before {
          content: ''; display: block; height: 2px; margin: -14px -14px 12px;
          background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #6366f1);
          border-radius: 16px 16px 0 0;
        }

        .tt-matrix { width: 100%; border-collapse: separate; border-spacing: 5px; table-layout: fixed; }

        .tt-matrix thead th {
          padding: 10px 3px; font-size: 10px; font-weight: 800;
          text-align: center; border-radius: 8px; letter-spacing: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7); text-transform: uppercase;
        }
        .tt-matrix thead th.tt-th-day {
          color: #818cf8; background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.25); font-size: 11px;
        }
        .tt-matrix thead th.tt-th-lunch {
          color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.02);
          border-style: dashed;
        }

        .tt-day-cell {
          height: 76px; padding: 0 8px; border-radius: 8px; text-align: center;
          font-size: 12px; font-weight: 900; vertical-align: middle;
          letter-spacing: 0.02em; border: 1px solid;
        }

        .tt-matrix tbody td { height: 76px; vertical-align: middle; }

        .tt-cell-filled { padding: 3px; }
        .tt-cell-empty {
          padding: 3px; text-align: center;
          border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.01);
        }
        .tt-cell-lunch {
          background: rgba(255,255,255,0.02); border-style: dashed;
          border-color: rgba(255,255,255,0.08);
        }
        .tt-lunch-label {
          writing-mode: vertical-rl; text-transform: uppercase;
          letter-spacing: 3px; font-size: 9.5px; font-weight: 800;
          color: rgba(255,255,255,0.2); margin: 0 auto; display: block;
        }
        .tt-subject-card {
          border-radius: 8px; border: 1px solid; padding: 6px 8px;
          height: 70px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; justify-content: center;
          overflow: hidden; transition: box-shadow 0.15s;
        }
        .tt-subject-card:hover { box-shadow: 0 0 0 2px rgba(255,255,255,0.15); z-index: 2; position: relative; }

        .tt-subject-name {
          font-size: 11px; font-weight: 800; color: #ffffff;
          line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tt-subject-code {
          font-size: 9.5px; font-weight: 600; color: rgba(255,255,255,0.75); margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tt-subject-room {
          display: inline-block; margin-top: 3px; font-size: 9px; font-weight: 800;
          color: #ffffff; background: rgba(255, 255, 255, 0.22);
          padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.35);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
          letter-spacing: 0.2px;
        }
      `}</style>

      {/* Toolbar */}
      <div className="tt-toolbar">
        <div className="tt-toolbar-left">
          <div className="tt-toolbar-title">
            <Clock size={16} color="#818cf8" />
            Weekly Schedule
          </div>
          <span className="tt-stat-pill"><BookOpen size={12} /><strong>{subjects.length}</strong> subjects</span>
          <span className="tt-stat-pill"><Clock size={12} /><strong>{totalSlots}</strong> sessions/week</span>
          <span className="tt-stat-pill"><strong>{displayDays.length}</strong> active days</span>
        </div>
        <button type="button" className="tt-pdf-btn" onClick={() => exportTimetablePDF(subjects)}
          title="Download a clean white PDF — perfect for printing or viewing in light">
          <Download size={15} />
          Download PDF
        </button>
      </div>

      {/* Subject legend */}
      {subjects.length > 0 && (
        <div className="tt-legend">
          {subjects.map((s, i) => {
            const col = WEB_PALETTE[i % WEB_PALETTE.length];
            return (
              <span key={s._id} className="tt-legend-item">
                <span className="tt-legend-dot" style={{ background: col.border }} />
                {s.name}
                {s.code && <span style={{ color: '#64748b', fontWeight: 500 }}>({s.code})</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.map((c, i) => (
        <div key={i} className="tt-conflict">
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {c}
        </div>
      ))}

      {/* Grid */}
      <div className="tt-grid-wrap">
        <table className="tt-matrix" style={{ minWidth: `${Math.max(1040, (matrixSlots.length + 1) * 95)}px` }}>
          <colgroup>
            <col style={{ width: '110px' }} />
            {matrixSlots.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="tt-th-day">Day</th>
              {matrixSlots.map((slot, i) => (
                <th key={i} className={slot.isLunch ? 'tt-th-lunch' : ''}>{slot.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayDays.map(day => {
              const accent = DAY_WEB[day] || DAY_WEB.Mon;
              return (
                <tr key={day}>
                  <td className="tt-day-cell" style={{ color: accent.color, background: accent.bg, borderColor: `${accent.color}33` }}>
                    {FULL_DAYS[day]}
                  </td>
                  {renderMatrixRowCells(day)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
