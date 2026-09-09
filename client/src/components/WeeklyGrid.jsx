import { useMemo } from 'react';
import { Download, Clock, BookOpen, AlertTriangle, Camera } from 'lucide-react';
// html2canvas and jsPDF are dynamically imported inside exportTimetableImage /
// exportTimetablePDF so they are excluded from the main bundle and only
// downloaded when the user actually clicks an export button.

/* ── Shared constants ─────────────────────────────────────────────────────── */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

const MATRIX_SLOTS = [
  { label: '8–9 AM',   start: 8 * 60,  end: 9 * 60  },
  { label: '9–10 AM',  start: 9 * 60,  end: 10 * 60 },
  { label: '10–11 AM', start: 10 * 60, end: 11 * 60 },
  { label: '11–12 PM', start: 11 * 60, end: 12 * 60 },
  { label: '12–1 PM',  start: 12 * 60, end: 13 * 60 },
  { label: '2–3 PM',   start: 14 * 60, end: 15 * 60 },
  { label: '3–4 PM',   start: 15 * 60, end: 16 * 60 },
  { label: '4–5 PM',   start: 16 * 60, end: 17 * 60 },
  { label: '5–7 PM',   start: 17 * 60, end: 19 * 60 },
];

/* Web & Export — vibrant, high-contrast modern palette */
const WEB_PALETTE = [
  { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: '#60a5fa', glow: 'rgba(59,130,246,0.3)', dot: '#3b82f6', accent: '#93c5fd', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // DBMS Blue
  { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', border: '#34d399', glow: 'rgba(16,185,129,0.3)', dot: '#10b981', accent: '#6ee7b7', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // SC Green
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', border: '#fbbf24', glow: 'rgba(245,158,11,0.3)', dot: '#f59e0b', accent: '#fde68a', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // SE Amber
  { bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: '#f87171', glow: 'rgba(239,68,68,0.3)', dot: '#ef4444', accent: '#fca5a5', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // TOC Red
  { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: '#c084fc', glow: 'rgba(139,92,246,0.3)', dot: '#8b5cf6', accent: '#d8b4fe', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // Violet
  { bg: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', border: '#38bdf8', glow: 'rgba(14,165,233,0.3)', dot: '#0ea5e9', accent: '#7dd3fc', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // Cyan
  { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', border: '#f472b6', glow: 'rgba(236,72,153,0.3)', dot: '#ec4899', accent: '#f9a8d4', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // Rose
  { bg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', border: '#2dd4bf', glow: 'rgba(20,184,166,0.3)', dot: '#14b8a6', accent: '#5eead4', text: '#ffffff', codeFg: 'rgba(255,255,255,0.78)', roomBg: 'rgba(255,255,255,0.18)', roomText: '#ffffff' }, // Teal
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
  Sun: { color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
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
  const str = String(t).trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = str.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
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
      const endMin = toMinutes(slot.endTime) || (startMin + 60);
      byDay[slot.day].push({
        name: s.name,
        code: s.code,
        instructor: s.instructor,
        room: slot.room,
        startTime: slot.startTime,
        endTime: slot.endTime,
        color,
        startMin,
        endMin,
      });
    });
  });
  DAYS.forEach(d => {
    byDay[d].sort((a, b) => a.startMin - b.startMin);
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
      const end   = toMinutes(slot.endTime);
      if (start < end) {
        boundaries.add(start);
        boundaries.add(end);
        rawSlots.push({ start, end });
      }
    });
  });

  if (boundaries.size < 2) return MATRIX_SLOTS;

  // Ensure 1:00 PM (780) and 2:00 PM (840) exist as boundaries when schedule spans across morning and afternoon
  const hasMorning = rawSlots.some(s => s.start < 13 * 60);
  const hasAfternoon = rawSlots.some(s => s.end > 14 * 60);
  const classCrossing1pm = rawSlots.some(s => s.start < 13 * 60 && s.end > 13 * 60);
  const classCrossing2pm = rawSlots.some(s => s.start < 14 * 60 && s.end > 14 * 60);
  const classDuring1to2 = rawSlots.some(s => s.start < 14 * 60 && s.end > 13 * 60);
  if (hasMorning && hasAfternoon && !classDuring1to2 && !classCrossing1pm && !classCrossing2pm) {
    boundaries.add(13 * 60);
    boundaries.add(14 * 60);
  }

  // Sort every unique boundary (start or end of any class)
  const sortedBounds = [...boundaries].sort((a, b) => a - b);

  // Build columns by walking the sorted boundaries in order.
  // Each adjacent pair [sortedBounds[i], sortedBounds[i+1]] becomes one column.
  const slots = [];
  for (let i = 0; i < sortedBounds.length - 1; i++) {
    const curr = sortedBounds[i];
    const next = sortedBounds[i + 1];

    const hasClass = rawSlots.some(s => s.start <= curr && s.end >= next);
    const isMiddayGap =
      (curr >= 11 * 60 + 30 && next <= 15 * 60 + 30) &&
      (next - curr >= 30) &&
      !rawSlots.some(s => s.start < next && s.end > curr);

    if (!hasClass && !isMiddayGap) continue;

    slots.push({
      label: fmtSlotLabel(curr, next),
      start: curr,
      end:   next,
    });
  }

  return slots.length > 0 ? slots : MATRIX_SLOTS;
};

/* ── Timetable export builder (used for both Photo and PDF) ──────────────── */
export function buildTimetableExportElement(subjects) {
  if (!subjects?.length) return null;

  const matrixSlots = getDynamicMatrixSlots(subjects);
  const colorMap = {};
  subjects.forEach((s, i) => { colorMap[s._id] = WEB_PALETTE[i % WEB_PALETTE.length]; });
  const eventsByDay = buildEventsByDay(subjects, colorMap);
  const activeDays = DAYS.filter(d => eventsByDay[d]?.length > 0);
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  let totalSessions = 0;
  subjects.forEach(s => { totalSessions += (s.schedule || []).length; });

  // Generous fixed dimensions — enough for 4 lines of text with no clipping
  const DAY_COL_W = 130;   // px — day label column
  const SLOT_COL_W = 160;  // px — each time-slot column
  const CELL_H = 110;      // px — row height (name + code + room + teacher/time)
  const HEADER_H = 38;     // px — time-slot header row height
  const SPACING = 5;       // px — border-spacing between cells
  const PAD = 20;          // px — outer container padding (each side)

  const totalCols = 1 + matrixSlots.length; // day col + N slot cols
  const exportWidth = DAY_COL_W + matrixSlots.length * SLOT_COL_W + (totalCols + 1) * SPACING + PAD * 2 + 32;

  // ── Header cells ────────────────────────────────────────────────────────────
  const thsHtml = matrixSlots.map(slot => `
    <th style="
      width: ${SLOT_COL_W}px;
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.10);
      padding: 0 4px;
      height: ${HEADER_H}px;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      border-radius: 8px;
      text-transform: uppercase;
      white-space: nowrap;
      letter-spacing: 0.2px;
      box-sizing: border-box;
      vertical-align: middle;
    ">${slot.label}</th>
  `).join('');

  // ── Body rows ────────────────────────────────────────────────────────────────
  let rowsHtml = '';
  displayDays.forEach(day => {
    const accent = DAY_WEB[day] || DAY_WEB.Mon;
    const dayEvents = eventsByDay[day] || [];
    let cellsHtml = '';
    let sIdx = 0;

    while (sIdx < matrixSlots.length) {
      const slot = matrixSlots[sIdx];
      const matchingEvents = dayEvents.filter(ev => ev.startMin < slot.end && ev.endMin > slot.start);
      const startedEarlier  = dayEvents.some(ev => ev.startMin < slot.start && ev.endMin > slot.start);

      if (startedEarlier) { sIdx++; continue; }

      if (matchingEvents.length > 0) {
        const maxEndMin = Math.max(...matchingEvents.map(ev => ev.endMin));
        let span = 1;
        while (sIdx + span < matrixSlots.length && matrixSlots[sIdx + span].start < maxEndMin) span++;

        const ev  = matchingEvents[0];
        const col = ev.color || WEB_PALETTE[0];
        const formattedCode = ev.code ? ev.code.replace(/\+/g, ' + ') : '';

        // Card width = span columns + (span-1) spacers
        const cardW = span * SLOT_COL_W + (span - 1) * SPACING;

        cellsHtml += `
          <td colspan="${span}" style="
            height: ${CELL_H}px;
            padding: ${SPACING / 2}px;
            vertical-align: middle;
            box-sizing: border-box;
          ">
            <div style="
              background: ${col.bg};
              border: 1px solid rgba(255,255,255,0.22);
              box-shadow: 0 2px 10px ${col.glow};
              border-radius: 9px;
              padding: 8px 10px;
              width: ${cardW}px;
              min-height: ${CELL_H - SPACING}px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              gap: 2px;
              overflow: hidden;
            ">
              <!-- Subject name — wraps freely, no ellipsis -->
              <div style="
                font-size: 14px;
                font-weight: 900;
                color: #ffffff;
                line-height: 1.25;
                word-break: break-word;
                white-space: normal;
                letter-spacing: -0.1px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.55);
              ">${ev.name}</div>

              <!-- Subject code -->
              ${formattedCode ? `
                <div style="
                  font-size: 10px;
                  font-weight: 600;
                  color: rgba(255,255,255,0.82);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                ">${formattedCode}</div>
              ` : ''}

              <!-- Room chip -->
              ${ev.room ? `
                <div style="margin-top: 2px;">
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #ffffff;
                    background: rgba(255,255,255,0.18);
                    border: 1px solid rgba(255,255,255,0.55);
                    padding: 2px 8px;
                    border-radius: 5px;
                    white-space: nowrap;
                  ">
                    <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; opacity: 0.8;">ROOM</span>
                    <strong style="font-size: 11.5px; font-weight: 900;">${ev.room}</strong>
                  </span>
                </div>
              ` : ''}

              <!-- Teacher & time on one line -->
              ${(ev.instructor || (ev.startTime && ev.endTime)) ? `
                <div style="
                  margin-top: 2px;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 6px;
                  font-size: 10px;
                  font-weight: 500;
                  color: rgba(255,255,255,0.80);
                  overflow: hidden;
                ">
                  ${ev.instructor ? `
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto;">${ev.instructor}</span>
                  ` : '<span></span>'}
                  ${(ev.startTime && ev.endTime) ? `
                    <span style="white-space: nowrap; flex-shrink: 0; font-size: 9.5px; opacity: 0.88;">${fmt12(ev.startTime)} – ${fmt12(ev.endTime)}</span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </td>`;
        sIdx += span;
      } else {
        cellsHtml += `
          <td style="
            height: ${CELL_H}px;
            padding: ${SPACING / 2}px;
            vertical-align: middle;
            box-sizing: border-box;
          ">
            <div style="
              height: ${CELL_H - SPACING}px;
              width: 100%;
              border-radius: 8px;
              border: 1px solid rgba(255,255,255,0.04);
              background: #080d18;
              box-sizing: border-box;
            "></div>
          </td>`;
        sIdx++;
      }
    }

    rowsHtml += `
      <tr>
        <td style="
          height: ${CELL_H}px;
          padding: ${SPACING / 2}px;
          vertical-align: middle;
          box-sizing: border-box;
        ">
          <div style="
            height: ${CELL_H - SPACING}px;
            width: ${DAY_COL_W}px;
            border-radius: 8px;
            background: #0c1322;
            border: 1px solid rgba(255,255,255,0.08);
            color: ${accent.color};
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.02em;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            box-sizing: border-box;
          ">${FULL_DAYS[day]}</div>
        </td>
        ${cellsHtml}
      </tr>`;
  });

  // ── Legend ────────────────────────────────────────────────────────────────────
  const legendHtml = subjects.map((s, i) => {
    const col = WEB_PALETTE[i % WEB_PALETTE.length];
    const count = (s.schedule || []).length;
    return `
      <span style="
        display: inline-flex; align-items: center; gap: 7px;
        padding: 4px 12px 4px 8px; border-radius: 20px;
        background: #0d1424; border: 1px solid rgba(255,255,255,0.10);
        font-size: 12px; font-weight: 600; color: #cbd5e1;
        white-space: nowrap;
      ">
        <span style="
          width: 10px; height: 10px; border-radius: 50%;
          background: ${col.border}; display: inline-block; flex-shrink: 0;
          box-shadow: 0 0 8px ${col.glow};
        "></span>
        <span style="color: #ffffff; font-weight: 800;">${s.name}</span>
        ${s.code ? `<span style="color: #94a3b8; font-weight: 500;">(${s.code})</span>` : ''}
        <span style="
          font-size: 10px; font-weight: 700; color: #818cf8;
          background: rgba(99,102,241,0.22); padding: 1px 7px; border-radius: 10px;
        ">${count}x/wk</span>
      </span>`;
  }).join('');

  // ── Container ────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'timetable-export-container';
  container.style.cssText = `
    width: ${exportWidth}px;
    background: #000000;
    color: #f8fafc;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: ${PAD}px ${PAD + 8}px;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  `;

  container.innerHTML = `
    <!-- Header bar -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
          flex-shrink: 0;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">Weekly Schedule</div>
          <div style="font-size: 12px; font-weight: 500; color: #94a3b8; margin-top: 2px;">StudentAI · Academic Timetable Export</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span style="
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 13px; border-radius: 20px; font-size: 12px; font-weight: 600;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;
        "><strong style="color: #e2e8f0; font-weight: 700;">${subjects.length}</strong>&nbsp;subjects</span>
        <span style="
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 13px; border-radius: 20px; font-size: 12px; font-weight: 600;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;
        "><strong style="color: #e2e8f0; font-weight: 700;">${totalSessions}</strong>&nbsp;sessions/week</span>
        <span style="
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 13px; border-radius: 20px; font-size: 12px; font-weight: 600;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;
        "><strong style="color: #e2e8f0; font-weight: 700;">${displayDays.length}</strong>&nbsp;active days</span>
      </div>
    </div>

    <!-- Legend -->
    <div style="
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
      padding: 12px 16px; border-radius: 12px;
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
    ">${legendHtml}</div>

    <!-- Grid -->
    <div style="
      border-radius: 16px;
      background: #080d1a;
      border: 1px solid rgba(255,255,255,0.10);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.6);
      padding: 14px;
      box-sizing: border-box;
      width: 100%;
      overflow: visible;
    ">
      <!-- Rainbow stripe -->
      <div style="height: 3px; margin: -14px -14px 12px; background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #f59e0b, #6366f1); border-radius: 16px 16px 0 0;"></div>

      <table style="
        border-collapse: separate;
        border-spacing: ${SPACING}px;
        table-layout: fixed;
        width: 100%;
        box-sizing: border-box;
      ">
        <colgroup>
          <col style="width: ${DAY_COL_W}px;" />
          ${matrixSlots.map(() => `<col style="width: ${SLOT_COL_W}px;" />`).join('')}
        </colgroup>
        <thead>
          <tr>
            <th style="
              padding: 0;
              border: none;
              width: ${DAY_COL_W}px;
              height: ${HEADER_H}px;
              vertical-align: middle;
            ">
              <div style="
                height: ${HEADER_H}px;
                width: ${DAY_COL_W}px;
                padding: 0 8px;
                border-radius: 8px;
                background: #0f172a;
                border: 1px solid rgba(99,102,241,0.35);
                color: #a5b4fc;
                font-size: 12px;
                font-weight: 800;
                display: flex;
                align-items: center;
                justify-content: center;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                box-sizing: border-box;
              ">DAY</div>
            </th>
            ${thsHtml}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 14px; padding: 0 4px;
      font-size: 11px; font-weight: 600; color: #475569;
    ">
      <div>StudentAI • Academic Schedule Export</div>
      <div>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  `;

  return container;
}

/* ── Photo Export (PNG image download) — Maximised High-Res Full Grid ─── */
export async function exportTimetableImage(subjects, filename = 'Student_Timetable.png') {
  if (!subjects?.length) return;
  const container = buildTimetableExportElement(subjects);
  if (!container) return;

  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    // Dynamic import — only fetches html2canvas (~40 KB) when user clicks export
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, {
      scale: 2.5, // Ultra-sharp 2.5x retina rendering
      useCORS: true,
      logging: false,
      backgroundColor: '#000000',
    });
    const link = document.createElement('a');
    link.download = typeof filename === 'string' ? filename : 'Student_Timetable.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/* ── PDF export — matched to timetable aspect ratio (zero empty bars, fully maximised) ── */
export async function exportTimetablePDF(subjects, filename = 'Student_Timetable.pdf') {
  if (!subjects?.length) return;
  const container = buildTimetableExportElement(subjects);
  if (!container) return;

  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    // Dynamic imports — html2canvas (~40 KB) + jsPDF (~80 KB) only when needed
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(container, {
      scale: 2.5, // Ultra-sharp 2.5x retina rendering
      useCORS: true,
      logging: false,
      backgroundColor: '#000000',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgRatio = canvas.width / canvas.height;
    const pdfWidth = 297; // mm (A4 landscape)
    const pdfHeight = pdfWidth / imgRatio; // Exact matching height so timetable fills 100% without letterboxing

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(typeof filename === 'string' ? filename : 'Student_Timetable.pdf');
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
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
                borderLeft: `4px solid ${col.accent}`,
                borderTop: `1px solid ${col.accent}22`,
                borderRight: `1px solid ${col.accent}22`,
                borderBottom: `1px solid ${col.accent}22`,
                boxShadow: `0 2px 8px ${col.glow}`,
              }}
              title={`${ev.name}${code ? ` (${code})` : ''}${ev.instructor ? ` · ${ev.instructor}` : ''}${ev.room ? ` · Room ${ev.room}` : ''}`}
            >
              {/* Subject name */}
              <div className="tt-subject-name" style={{ color: col.text }}>{ev.name}</div>
              {code && <div className="tt-subject-code" style={{ color: col.codeFg }}>{code}</div>}

              {/* Room chip */}
              {ev.room && (
                <div className="tt-room-wrap">
                  <span className="tt-subject-room" style={{ background: col.roomBg, color: col.roomText }}>
                    <span className="tt-room-lbl">Room</span>
                    <strong>{ev.room}</strong>
                  </span>
                </div>
              )}

              {/* Teacher & Time */}
              {(ev.instructor || (ev.startTime && ev.endTime)) && (
                <div className="tt-meta-row">
                  {ev.instructor ? <span className="tt-subject-teacher" style={{ color: col.text }}>{ev.instructor}</span> : <span />}
                  {ev.startTime && ev.endTime && (
                    <span className="tt-subject-time" style={{ color: col.accent }}>{fmt12(ev.startTime)} – {fmt12(ev.endTime)}</span>
                  )}
                </div>
              )}
            </div>
          </td>
        );
        sIdx += span;
      } else {
        cells.push(
          <td key={sIdx} className="tt-cell-empty">
            <div className="tt-cell-empty-inner" />
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
        /* ── Root & toolbar ── */
        .tt-root { --tt-surface: #080d18; }

        .tt-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
        }
        .tt-toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
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

        .tt-photo-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 10px; cursor: pointer;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none; color: #fff; font-size: 13px; font-weight: 700;
          box-shadow: 0 4px 16px rgba(16,185,129,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .tt-photo-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(16,185,129,0.5); }

        .tt-conflict {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; border-radius: 10px; margin-bottom: 12px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; font-size: 12.5px; font-weight: 500;
        }

        /* ── Legend ── */
        .tt-legend {
          display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;
          padding: 10px 14px; border-radius: 12px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
        }
        .tt-legend-item {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 4px 10px 4px 6px; border-radius: 8px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          font-size: 11.5px; font-weight: 600; color: #cbd5e1;
        }
        .tt-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

        /* ── Grid wrapper ── */
        .tt-grid-wrap {
          overflow-x: auto; border-radius: 16px;
          background: var(--tt-surface);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.55);
          padding: 14px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: rgba(99,102,241,0.4) rgba(255,255,255,0.02);
        }
        .tt-grid-wrap::-webkit-scrollbar { height: 6px; }
        .tt-grid-wrap::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 3px; }
        .tt-grid-wrap::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 3px; }
        .tt-grid-wrap::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.7); }
        .tt-grid-wrap::before {
          content: ''; display: block; height: 3px; margin: -14px -14px 12px;
          background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #f59e0b, #6366f1);
          border-radius: 16px 16px 0 0;
        }

        /* ── Table ── */
        .tt-matrix {
          width: 100%; border-collapse: separate; border-spacing: 5px; table-layout: fixed;
        }
        .tt-matrix thead th {
          padding: 9px 4px; font-size: 10.5px; font-weight: 800;
          text-align: center; border-radius: 8px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.75); text-transform: uppercase; letter-spacing: 0.2px;
        }
        .tt-matrix thead th.tt-th-day { padding: 0; border: none; }
        .tt-day-header-card {
          height: 36px; padding: 0 8px; border-radius: 8px;
          background: #0f172a; border: 1px solid rgba(99,102,241,0.35);
          color: #a5b4fc; font-size: 11px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          letter-spacing: 0.05em; text-transform: uppercase;
        }

        /* ── Day label cells ── */
        .tt-day-cell { padding: 3px; border: none; vertical-align: middle; }
        .tt-day-card {
          height: 100%; min-height: 96px; border-radius: 10px; text-align: center;
          font-size: 12px; font-weight: 800; letter-spacing: 0.03em;
          display: flex; align-items: center; justify-content: center;
          background: #0c1322; border: 1px solid rgba(255,255,255,0.09);
          box-sizing: border-box;
        }

        .tt-matrix tbody td { vertical-align: top; }

        /* ── Empty cell ── */
        .tt-cell-filled { padding: 3px; vertical-align: top; }
        .tt-cell-empty  { padding: 3px; vertical-align: top; }
        .tt-cell-empty-inner {
          min-height: 96px; width: 100%; box-sizing: border-box;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.015);
        }

        /* ── Subject card — LIGHT theme ── */
        .tt-subject-card {
          border-radius: 10px;
          border-left-width: 4px !important;
          border-left-style: solid !important;
          padding: 8px 10px;
          min-height: 96px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; justify-content: flex-start; gap: 2px;
          overflow: hidden;
          transition: transform 0.12s ease, box-shadow 0.15s ease;
          cursor: default;
        }
        .tt-subject-card:hover {
          transform: translateY(-2px);
          z-index: 2; position: relative;
        }

        /* Subject name: large, dark, wraps freely */
        .tt-subject-name {
          font-size: 13px; font-weight: 800;
          line-height: 1.25;
          white-space: normal; word-break: break-word;
          letter-spacing: -0.1px;
        }

        /* Code: slightly smaller, accent color */
        .tt-subject-code {
          font-size: 10px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          opacity: 0.8;
        }

        /* Room chip: solid color badge, very readable */
        .tt-room-wrap { margin-top: 4px; }
        .tt-subject-room {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11.5px; font-weight: 700;
          padding: 2px 9px 2px 7px; border-radius: 6px;
          white-space: nowrap; box-sizing: border-box;
          letter-spacing: 0.1px;
        }
        .tt-room-lbl {
          font-size: 8.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; opacity: 0.80;
        }

        /* Teacher & time row */
        .tt-meta-row {
          margin-top: 3px; display: flex; align-items: center;
          justify-content: space-between; gap: 4px; overflow: hidden;
        }
        .tt-subject-teacher {
          font-size: 9px; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
          opacity: 0.70;
        }
        .tt-subject-time {
          font-size: 8.5px; font-weight: 600;
          white-space: nowrap; flex-shrink: 0; opacity: 0.85;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .tt-toolbar { flex-direction: column; align-items: stretch; }
          .tt-photo-btn, .tt-pdf-btn { width: 100%; justify-content: center; padding: 10px 16px; }
          .tt-grid-wrap { padding: 8px; border-radius: 12px; }
          .tt-matrix { border-spacing: 3px; }
          .tt-subject-name { font-size: 12px; }
          .tt-subject-room { font-size: 10.5px; padding: 1.5px 6px; }
          .tt-stat-pill { font-size: 10.5px; padding: 3px 8px; }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="tt-photo-btn"
            onClick={() => exportTimetableImage(subjects)}
            title="Download timetable as a high-resolution photo (PNG)"
          >
            <Camera size={15} />
            Download Photo
          </button>
          <button
            type="button"
            className="tt-pdf-btn"
            onClick={() => exportTimetablePDF(subjects)}
            title="Download timetable as PDF"
          >
            <Download size={15} />
            Download PDF
          </button>
        </div>
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
        <table className="tt-matrix" style={{ minWidth: `${Math.max(900, 120 + matrixSlots.length * 140)}px` }}>
          <colgroup>
            <col style={{ width: '120px' }} />
            {matrixSlots.map((_, i) => <col key={i} style={{ minWidth: '140px' }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="tt-th-day">
                <div className="tt-day-header-card">DAY</div>
              </th>
              {matrixSlots.map((slot, i) => (
                <th key={i}>{slot.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayDays.map(day => {
              const accent = DAY_WEB[day] || DAY_WEB.Mon;
              return (
                <tr key={day}>
                  <td className="tt-day-cell">
                    <div
                      className="tt-day-card"
                      style={{
                        color: accent.color,
                        borderColor: `${accent.color}44`,
                      }}
                    >
                      {FULL_DAYS[day]}
                    </div>
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
