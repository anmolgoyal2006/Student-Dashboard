import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import {
  Calendar, Check, X, Flame, BookOpen,
  ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck,
  CalendarCheck, CheckCircle, XCircle,
  AlertTriangle, CalendarDays, ClipboardList, SlidersHorizontal,
} from "lucide-react";
import EmptyState from "./EmptyState";
import TodayScheduleCard from "./TodayScheduleCard";
import MonthlyCalendarCard from "./MonthlyCalendarCard";

/* ─── helpers ─── */
const pctColorVar = (p) => p >= 75 ? "var(--color-success)" : p >= 50 ? "var(--color-warning)" : "var(--color-danger)";
const pctMutedVar = (p) => p >= 75 ? "var(--color-success-muted)" : p >= 50 ? "var(--color-warning-muted)" : "var(--color-danger-muted)";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ─── Icon badge ─── */
const IconBadge = ({ icon: Icon, colorVar, mutedVar, size = 18 }) => (
  <div style={{
    width: 40, height: 40, borderRadius: "var(--radius-md)",
    background: mutedVar,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }}>
    <Icon size={size} color={colorVar} strokeWidth={1.8} />
  </div>
);

/* ─── Stat card ─── */
const StatCard = ({ label, value, icon: Icon, colorVar, mutedVar, subLabel, valueFontSize = 28 }) => (
  <div
    style={{
      background: "var(--color-surface-2)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "var(--radius-lg)",
      padding: "24px 16px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 10, textAlign: "center",
      transition: "border-color 0.18s, background 0.18s",
      cursor: "default",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = "var(--color-surface-3)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "var(--color-surface-2)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
    }}
  >
    <IconBadge icon={Icon} colorVar={colorVar} mutedVar={mutedVar} />
    <div style={{ lineHeight: 1 }}>
      <div style={{ fontSize: valueFontSize, fontWeight: 700, color: colorVar, letterSpacing: "-0.5px" }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6,
      }}>
        {label}
      </div>
      {subLabel && (
        <div style={{ fontSize: 8, fontWeight: 500, color: "var(--color-text-tertiary)", marginTop: 2 }}>
          {subLabel}
        </div>
      )}
    </div>
  </div>
);

/* ─── Section header ─── */
const SectionHeader = ({ icon: Icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0 }} />
    <Icon size={14} color="var(--color-accent)" strokeWidth={2} />
    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.1px" }}>
      {children}
    </span>
  </div>
);

/* ─── Insight banner ─── */
const Insight = ({ present, total }) => {
  if (!total) return null;
  const pct = (present / total) * 100;
  let bg, border, color, Icon, text;

  if (pct >= 75) {
    const miss = Math.floor(present / 0.75 - total);
    bg     = "var(--color-success-muted)";
    border = "rgba(16,185,129,0.28)";
    color  = "var(--color-success)";
    Icon   = CheckCircle;
    text   = miss > 0
      ? `Safe · can miss up to ${miss} more class${miss > 1 ? "es" : ""}`
      : "Safe but tight — don't miss upcoming classes";
  } else {
    const need = Math.ceil((0.75 * total - present) / 0.25);
    bg     = "var(--color-danger-muted)";
    border = "rgba(239,68,68,0.28)";
    color  = "var(--color-danger)";
    Icon   = AlertTriangle;
    text   = `Attend next ${need} consecutive class${need > 1 ? "es" : ""} to reach 75%`;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      marginTop: 8, padding: "5px 10px", borderRadius: "var(--radius-sm)",
      background: bg, border: `1px solid ${border}`,
      color, fontSize: 11, fontWeight: 500,
    }}>
      <Icon size={11} strokeWidth={2} />
      <span>{text}</span>
    </div>
  );
};

/* ─── Card shell ─── */
const Card = ({ children, style = {} }) => (
  <div className="sa-card" style={{
    background: "var(--color-surface-2)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    minWidth: 0,
    ...style,
  }}>
    {children}
  </div>
);

/* ─── Legend chip ─── */
const LegendChip = ({ colorVar, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)" }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: colorVar, flexShrink: 0 }} />
    {label}
  </div>
);

/* ═══════════════════════════════════════════════════════ */
const StudentAttendanceView = ({ sid }) => {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [filter,      setFilter]      = useState("all");
  const [subjects,    setSubjects]    = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  /* ── initial balance modal states ── */
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustSubject, setAdjustSubject] = useState(null);
  const [adjustTotal, setAdjustTotal] = useState(0);
  const [adjustPresent, setAdjustPresent] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [calcTotal, setCalcTotal] = useState(0);
  const [calcPercent, setCalcPercent] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  /* ── retroactive marking modal states ── */
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [retroDate, setRetroDate] = useState(null);
  const [retroDateStr, setRetroDateStr] = useState("");
  const [retroSlots, setRetroSlots] = useState([]);
  const [markingRetro, setMarkingRetro] = useState({});

  /* ── today's scheduled classes from timetable ── */
  const todayClasses = useMemo(() => {
    if (!subjects?.length) return [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayName = dayNames[new Date().getDay()];
    const classes = [];
    subjects.forEach(s => {
      (s.schedule || [])
        .filter(sl => sl.day === todayName)
        .forEach(sl => {
          classes.push({
            subjectId: s._id,
            name: s.name,
            code: s.code,
            time: sl.startTime || "",
            slot: sl.day || "",
          });
        });
    });
    return classes.slice(0, 6);
  }, [subjects]);

  /* ── fetch ── */
  const fetchAttendance = async () => {
    try {
      setLoading(true); setError(null);
      const [ar, sr] = await Promise.all([
        API.get(`/attendance/student/${sid}`),
        API.get(`/timetable`),
      ]);
      setData(ar.data);
      setSubjects(sr.data.subjects || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load attendance data.");
    } finally { setLoading(false); }
  };

  // Attendance-only refresh: the timetable doesn't change when a class is
  // marked, so quick-mark reconciliation shouldn't re-pull it or flip the
  // page into a full loading state (TodayScheduleCard already shows the mark
  // optimistically).
  const refreshAttendanceRecords = async () => {
    try {
      const ar = await API.get(`/attendance/student/${sid}`);
      setData(ar.data);
    } catch {
      /* keep existing data; TodayScheduleCard rolls back its own optimistic mark on error */
    }
  };

  useEffect(() => {
    sid
      ? fetchAttendance()
      : (setLoading(false), setError("Please update your Student ID (SID) in Profile Settings to track your attendance."));
  }, [sid]);

  useEffect(() => { setCurrentPage(1); }, [filter]);

  /* ── retroactive marking click handler ── */
  const handleDayClick = (date, filterSubjectName) => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];
    
    // Find all schedule slots for this day of the week
    const slots = [];
    subjects.forEach(s => {
      // If a subject filter is active on the calendar, show only that subject
      if (filterSubjectName && s.name !== filterSubjectName) return;

      (s.schedule || [])
        .filter(sl => sl.day === dayName)
        .forEach((sl, idx) => {
          // Check if there is an existing record for this subject + date + slot_index
          const dateStr = date.toLocaleDateString('en-CA');
          const existing = data.records.find(r => {
            const rDate = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'UTC' });
            const isMatch = rDate === dateStr && 
                            (r.subjectId === s._id || r.code === s.code) &&
                            (r.slot === `slot_${idx}` || (!r.slot && idx === 0));
            return isMatch;
          });
          
          slots.push({
            subjectId: s._id,
            name: s.name,
            code: s.code,
            time: sl.startTime || "",
            endTime: sl.endTime || "",
            slotIndex: idx,
            status: existing ? existing.status : null,
          });
        });
    });

    setRetroDate(date);
    setRetroDateStr(date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }));
    setRetroSlots(slots);
    setShowRetroModal(true);
  };

  const handleMarkRetro = async (subjectId, slotIndex, status) => {
    const key = `${subjectId}_${slotIndex}`;
    setMarkingRetro(prev => ({ ...prev, [key]: true }));

    const dateStr = retroDate.toLocaleDateString('en-CA');
    try {
      if (status === "unmarked") {
        await API.delete("/attendance", {
          data: {
            subjectId,
            date: dateStr,
            slot: `slot_${slotIndex}`
          }
        });
        toast.success("Attendance cleared!");
      } else {
        await API.post("/attendance", {
          subjectId,
          date: dateStr,
          status,
          slot: `slot_${slotIndex}`
        });
        toast.success(`Marked as ${status}!`);
      }
      
      setRetroSlots(prev => prev.map(s => {
        if (s.subjectId === subjectId && s.slotIndex === slotIndex) {
          return { ...s, status: status === "unmarked" ? null : status };
        }
        return s;
      }));

      await refreshAttendanceRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update attendance.");
    } finally {
      setMarkingRetro(prev => ({ ...prev, [key]: false }));
    }
  };

  /* ── initial balance handlers ── */
  const handleOpenAdjustModal = (subject) => {
    setAdjustSubject(subject);
    setAdjustTotal(subject.initialTotal || 0);
    setAdjustPresent(subject.initialPresent || 0);
    setCalcTotal(subject.initialTotal || 0);
    setCalcPercent("");
    setShowCalc(false);
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = async () => {
    if (parseInt(adjustPresent, 10) > parseInt(adjustTotal, 10)) {
      toast.error("Attended classes cannot exceed total classes conducted.");
      return;
    }

    setSubmittingAdjust(true);
    try {
      await API.put(`/timetable/${adjustSubject.subjectId}`, {
        initialPresent: parseInt(adjustPresent, 10),
        initialTotal: parseInt(adjustTotal, 10)
      });
      toast.success("Initial balance updated successfully!");
      setShowAdjustModal(false);
      await fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update initial balance.");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleApplyCalc = () => {
    const totalVal = parseInt(calcTotal, 10);
    const pctVal = parseFloat(calcPercent);
    if (isNaN(totalVal) || isNaN(pctVal) || totalVal < 0 || pctVal < 0 || pctVal > 100) {
      toast.error("Please enter valid positive numbers. Percentage must be between 0 and 100.");
      return;
    }
    const attended = Math.round(totalVal * (pctVal / 100));
    setAdjustTotal(totalVal);
    setAdjustPresent(attended);
    setShowCalc(false);
    toast.info(`Calculated: ${attended} attended out of ${totalVal} classes (${pctVal}%).`);
  };

  /* ── quick mark (from TodayScheduleCard) ── */
  const handleQuickMark = async (subjectId, date, status, slot) => {
    try {
      if (status === 'delete') {
        // Deselect — remove the record
        await API.delete(`/attendance`, { data: { subjectId, date, slot } });
        toast.success("Attendance cleared!");
      } else {
        await API.post(`/attendance`, { subjectId, date, status, slot });
        toast.success(`Marked ${status}!`);
      }
      refreshAttendanceRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark attendance.");
      throw err;
    }
  };

  /* ── subject streak ── */
  const getSubjectStreak = (code) => {
    if (!data?.records) return 0;
    const recs = data.records
      .filter(r => r.code === code && r.status !== "cancelled")
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let s = 0;
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i].status === "present") s++; else break;
    }
    return s;
  };

  /* ── filtered + paginated records ── */
  const filteredRecords = data?.records.filter(r => filter === "all" || r.status === filter) || [];
  const totalPages  = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const pageRecords = filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  /* ── loading ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{
        width: 34, height: 34,
        border: "3px solid rgba(255,255,255,0.08)",
        borderTopColor: "var(--color-accent)",
        borderRadius: "50%",
        animation: "sa-spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes sa-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── error ── */
  if (error) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "60vh", gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: "var(--color-danger-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ShieldAlert size={22} color="var(--color-danger)" strokeWidth={1.8} />
      </div>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
        {error}
      </p>
      {!sid && (
        <Link to="/profile" style={{
          padding: "9px 20px",
          background: "var(--color-accent)", color: "#fff",
          borderRadius: "var(--radius-md)",
          textDecoration: "none", fontSize: 13, fontWeight: 600,
        }}>
          Go to Profile Settings
        </Link>
      )}
    </div>
  );

  /* ════════════════════════════════════════
     STAT CARD COMPUTATIONS
     ════════════════════════════════════════ */
  const todayDate = new Date().toLocaleDateString('en-CA');

  /* Card 1 — Classes Today: count from timetable schedule, not marked records */
  const classesToday = todayClasses.length;

  /* Card 2 — Can Still Miss */
  // Count subjects where the student can still miss at least 1 class
  // (i.e. subjects currently safe enough to absorb 1 more absence)
  const subjectMissValues = (data?.summary || [])
    .filter(s => s.subject && s.subject !== "Unknown" && s.total > 0)
    .map(s => Math.floor(s.present / 0.75 - s.total));

  const canStillMiss  = subjectMissValues.filter(v => v >= 1).length;
  const rawMaxMiss    = canStillMiss; // kept for color logic reuse
  const canMissColor  = canStillMiss === 0 ? "var(--color-danger)" : canStillMiss <= 2 ? "var(--color-warning)" : "var(--color-success)";
  const canMissMuted  = canStillMiss === 0 ? "var(--color-danger-muted)" : canStillMiss <= 2 ? "var(--color-warning-muted)" : "var(--color-success-muted)";

  /* Card 3 — Subjects At Risk */
  const atRiskSubjects  = data?.summary?.filter(s => s.percentage < 75) || [];
  const criticalSubjects = data?.summary?.filter(s => s.percentage < 50) || [];
  const atRiskCount     = atRiskSubjects.length;
  const criticalCount   = criticalSubjects.length;
  const atRiskColor     = criticalCount > 0 ? "var(--color-danger)" : atRiskCount > 0 ? "var(--color-warning)" : "var(--color-success)";
  const atRiskMuted     = criticalCount > 0 ? "var(--color-danger-muted)" : atRiskCount > 0 ? "var(--color-warning-muted)" : "var(--color-success-muted)";
  const atRiskValue     = atRiskCount === 0 ? "All Safe" : `${atRiskCount}`;
  const atRiskFontSize  = atRiskCount === 0 ? 20 : 28;
  const atRiskSubLabel  = criticalCount > 0
    ? `${criticalCount} critical`
    : atRiskCount === 0 ? "above 75%" : "";

  /* Card 4 — Unmarked Today: count unmarked slots using todayClasses (slot-level, not subject-level) */
  const markedTodayBySubject = {};
  (data?.records?.filter(r => new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'UTC' }) === todayDate) || []).forEach(r => {
    const key = r.subjectId || r.code;
    markedTodayBySubject[key] = (markedTodayBySubject[key] || 0) + 1;
  });

  // Count how many slots are still unmarked
  const slotCounter = {};
  let unmarkedCount = 0;
  const unmarkedSlots = [];
  todayClasses.forEach(cls => {
    const key = cls.subjectId || cls.code;
    slotCounter[key] = (slotCounter[key] || 0) + 1;
    const markedCount = markedTodayBySubject[key] || 0;
    if (slotCounter[key] > markedCount) {
      unmarkedCount++;
      unmarkedSlots.push(cls);
    }
  });

  const unmarkedColor = unmarkedCount === 0 
    ? "var(--color-success)" 
    : unmarkedCount <= 2 
      ? "var(--color-warning)" 
      : "var(--color-danger)";
  const unmarkedMuted = unmarkedCount === 0 
    ? "var(--color-success-muted)" 
    : unmarkedCount <= 2 
      ? "var(--color-warning-muted)" 
      : "var(--color-danger-muted)";
  const unmarkedValue = unmarkedCount === 0 ? "All Done" : `${unmarkedCount}`;
  const unmarkedFontSize = unmarkedCount === 0 ? 18 : 28;
  const uniqueUnmarkedNames = [...new Set(unmarkedSlots.map(s => s.name))];
  const firstName = uniqueUnmarkedNames[0] || "";
  const unmarkedSubLabel = unmarkedCount === 0
    ? "great job!"
    : `${firstName.slice(0, 10)}${firstName.length > 10 ? "…" : ""}${
        uniqueUnmarkedNames.length > 1
          ? ` +${uniqueUnmarkedNames.length - 1} more`
          : unmarkedCount > 1
            ? ` (${unmarkedCount} slots)`
            : ""
      }`;

  const statCards = [
    {
      label: "CLASSES TODAY",
      value: classesToday,
      icon: CalendarDays,
      colorVar: "var(--color-accent)",
      mutedVar: "var(--color-accent-muted)",
    },
    {
      label: "CAN STILL MISS",
      value: canStillMiss,
      icon: ShieldCheck,
      colorVar: canMissColor,
      mutedVar: canMissMuted,
      subLabel: canStillMiss === 0 ? "no safe subjects" : `subject${canStillMiss > 1 ? "s" : ""} with buffer`,
    },
    {
      label: "SUBJECTS AT RISK",
      value: atRiskValue,
      icon: AlertTriangle,
      colorVar: atRiskColor,
      mutedVar: atRiskMuted,
      subLabel: atRiskSubLabel,
      valueFontSize: atRiskFontSize,
    },
    {
      label: "UNMARKED TODAY",
      value: unmarkedValue,
      icon: ClipboardList,
      colorVar: unmarkedColor,
      mutedVar: unmarkedMuted,
      subLabel: unmarkedSubLabel,
      valueFontSize: unmarkedFontSize,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", minWidth: 0 }}>
      <style>{`
        @keyframes sa-spin { to { transform: rotate(360deg); } }

        /* Custom premium styles for Adjust Balance inputs */
        .sa-modal-input::-webkit-outer-spin-button,
        .sa-modal-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .sa-modal-input {
          -moz-appearance: textfield;
          outline: none;
          transition: all 0.15s ease-in-out;
        }
        .sa-modal-input:focus {
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18) !important;
        }

        .sa-adjust-btn {
          font-size: 10.5px; font-family: inherit; font-weight: 600;
          color: var(--color-accent);
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.18);
          padding: 3.5px 10px; border-radius: var(--radius-sm);
          cursor: pointer; transition: all 0.15s ease;
          display: inline-flex; align-items: center; justify-content: center;
          white-space: nowrap;
        }
        .sa-adjust-btn:hover {
          background: rgba(99,102,241,0.14);
          border-color: rgba(99,102,241,0.35);
          box-shadow: 0 0 8px rgba(99,102,241,0.1);
        }

        .sa-ftab {
          background: none; border: none;
          padding: 7px 14px 9px; margin-bottom: -1px;
          font-size: 12.5px; font-family: inherit; font-weight: 500;
          color: var(--color-text-tertiary);
          cursor: pointer; transition: color 0.15s;
          border-bottom: 2px solid transparent;
          text-transform: capitalize;
        }
        .sa-ftab.active {
          color: var(--color-text-primary);
          border-bottom-color: var(--color-accent);
        }
        .sa-ftab:hover:not(.active) { color: var(--color-text-secondary); }

        .sa-tr {
          border-bottom: 1px solid rgba(255,255,255,0.03);
          transition: background 0.12s;
        }
        .sa-tr:hover { background: rgba(255,255,255,0.016); }

        .sa-pg-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: var(--radius-md);
          font-size: 12px; font-family: inherit; font-weight: 500;
          border: 1px solid rgba(255,255,255,0.08);
          background: var(--color-surface-3);
          color: var(--color-text-secondary);
          cursor: pointer; transition: all 0.15s;
        }
        .sa-pg-btn:hover:not(:disabled) {
          border-color: var(--color-accent);
          color: var(--color-text-primary);
        }
        .sa-pg-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .sa-sub-card {
          background: var(--color-surface-3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          transition: border-color 0.15s;
          min-width: 0;
        }
        .sa-sub-card:hover { border-color: rgba(255,255,255,0.10); }
        .sa-sub-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 8px;
          flex-wrap: nowrap;
        }
        .sa-sub-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          min-width: 0;
          flex: 1 1 0;
          row-gap: 3px;
        }
        .sa-sub-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .sa-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        .sa-table-scroll table {
          min-width: 300px;
        }
        @media (max-width: 480px) {
          .sa-sub-right { gap: 6px; }
          .sa-adjust-btn { font-size: 10px !important; padding: 3px 8px !important; }
        }

        .sa-2col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .sa-4col { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }

        @media (max-width: 900px) {
          .sa-2col { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .sa-4col { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .sa-4col { grid-template-columns: 1fr 1fr; gap: var(--space-2); }
        }
        @media (max-width: 768px) {
          .sa-card { padding: 14px !important; }
        }
        @media (max-width: 360px) {
          .sa-4col { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .sa-2col { gap: var(--space-3); }
          .sa-4col { gap: var(--space-2); }
        }
      `}</style>

      {/* ── STAT CARDS ── */}
      <div className="sa-4col">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── TODAY'S SCHEDULE + MONTHLY CALENDAR ── */}
      <div className="sa-2col">
        <TodayScheduleCard
          todayClasses={todayClasses}
          existingRecords={data.records}
          onQuickMark={handleQuickMark}
        />
        <MonthlyCalendarCard records={data.records} onDayClick={handleDayClick} />
      </div>

      {/* ── SUBJECT BREAKDOWN + RECORDS ── */}
      <div className="sa-2col">

        {/* Subject breakdown */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <SectionHeader icon={BookOpen}>Subject breakdown</SectionHeader>
            <div style={{ display: "flex", gap: "var(--space-4)", marginTop: -8, marginBottom: 12 }}>
              <LegendChip colorVar="var(--color-success)" label="≥ 75%" />
              <LegendChip colorVar="var(--color-warning)" label="50–74%" />
              <LegendChip colorVar="var(--color-danger)"  label="< 50%" />
            </div>
            <div style={{
              fontSize: "11px", color: "var(--color-text-secondary)",
              background: "rgba(255,255,255,0.02)", padding: "8px 12px",
              borderRadius: "var(--radius-sm)", border: "1px dashed rgba(255,255,255,0.06)",
              display: "flex", gap: "8px", alignItems: "center"
            }}>
              <span>💡</span>
              <span>Need to set your starting balance or manual offset? Click the <strong>Adjust Balance</strong> button next to any subject.</span>
            </div>
          </div>

          {data.summary.filter(s => s.subject && s.subject !== "Unknown").length === 0 ? (
            <EmptyState
              illustration="attendance"
              title="No records found"
              subtitle="Mark attendance above to see your subject-wise breakdown."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {data.summary
                .filter(s => s.subject && s.subject !== "Unknown")
                .map(subject => {
                  const streak = getSubjectStreak(subject.code);
                  const col    = pctColorVar(subject.percentage);
                  return (
                    <div key={subject.code} className="sa-sub-card">
                      <div className="sa-sub-row">
                        <div className="sa-sub-left">
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                            {subject.subject}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)",
                            background: "var(--color-surface-2)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            padding: "2px 7px", borderRadius: "var(--radius-sm)",
                            fontFamily: "monospace", whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}>{subject.code}</span>
                          {streak >= 2 && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              fontSize: 10, fontWeight: 700, color: "var(--color-warning)",
                              background: "var(--color-warning-muted)",
                              border: "1px solid rgba(245,158,11,0.2)",
                              padding: "2px 7px", borderRadius: "var(--radius-sm)",
                              flexShrink: 0,
                            }}>
                              <Flame size={9} fill="var(--color-warning)" /> {streak}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {subject.present}/{subject.total}
                          </span>
                        </div>

                        <div className="sa-sub-right">
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: col, whiteSpace: "nowrap" }}>
                            {subject.percentage}%
                          </span>
                          {subject.subjectId && (
                            <button
                              onClick={() => handleOpenAdjustModal(subject)}
                              className="sa-adjust-btn"
                              title="Adjust initial attendance offset"
                            >
                              Adjust Balance
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${subject.percentage}%`,
                          background: col, borderRadius: "var(--radius-pill)",
                          transition: "width 0.45s cubic-bezier(.4,0,.2,1)",
                        }} />
                      </div>
                      <Insight present={subject.present} total={subject.total} />
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        {/* Attendance records */}
        <Card>
          <SectionHeader icon={Calendar}>Attendance records</SectionHeader>

          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "var(--space-4)" }}>
            {["all", "present", "absent"].map(f => (
              <button key={f}
                className={`sa-ftab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="sa-table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Date", "Subject", "Code", "Status"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "8px 10px",
                      fontSize: 10.5, fontWeight: 600,
                      color: "var(--color-text-tertiary)",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRecords.length > 0 ? pageRecords.map((r, i) => (
                  <tr key={i} className="sa-tr">
                    <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                      {fmtDate(r.date)}
                    </td>
                    <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {r.subject}
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{
                        fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                        color: "var(--color-text-tertiary)",
                        background: "var(--color-surface-3)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        padding: "2px 7px", borderRadius: "var(--radius-sm)",
                      }}>{r.code}</span>
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: "var(--radius-pill)",
                        fontSize: 11, fontWeight: 600,
                        background: r.status === "present" ? "var(--color-success-muted)" : "var(--color-danger-muted)",
                        color:      r.status === "present" ? "var(--color-success)"       : "var(--color-danger)",
                        border:     `1px solid ${r.status === "present" ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)"}`,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: r.status === "present" ? "var(--color-success)" : "var(--color-danger)",
                        }} />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 32, fontSize: 13, color: "var(--color-text-tertiary)" }}>
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-4)" }}>
              <button className="sa-pg-btn" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <ChevronLeft size={13} /> Prev
              </button>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button className="sa-pg-btn" disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* ── Adjust Initial Balance Modal ── */}
      {showAdjustModal && adjustSubject && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: "var(--color-surface-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--radius-lg)", padding: 24, maxWidth: 450,
            width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                Adjust Initial Balance: {adjustSubject.subject}
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-text-tertiary)", transition: "all 0.15s"
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text-primary)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 16px 0" }}>
              Configure your attendance history for this subject before you started tracking here.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
                  Total Classes Conducted
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustTotal}
                  className="sa-modal-input"
                  onChange={e => setAdjustTotal(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: "100%", padding: "10px 14px", background: "var(--color-surface-3)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-md)",
                    color: "var(--color-text-primary)", fontSize: 13, fontFamily: "inherit"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
                  Classes Attended
                </label>
                <input
                  type="number"
                  min="0"
                  max={adjustTotal}
                  value={adjustPresent}
                  className="sa-modal-input"
                  onChange={e => setAdjustPresent(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: "100%", padding: "10px 14px", background: "var(--color-surface-3)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-md)",
                    color: "var(--color-text-primary)", fontSize: 13, fontFamily: "inherit"
                  }}
                />
              </div>

              {/* Calculator Toggle */}
              <div>
                <button
                  onClick={() => setShowCalc(!showCalc)}
                  style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer", fontSize: 11, color: "var(--color-accent)",
                    padding: "4px 10px", borderRadius: "var(--radius-pill)",
                    fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.06)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  {showCalc ? "✕ Close Calculator" : "💡 Calculate Attendance from Percentage"}
                </button>

                {showCalc && (
                  <div style={{
                    marginTop: 10, padding: 14, background: "rgba(99,102,241,0.04)",
                    borderRadius: "var(--radius-md)", border: "1px solid rgba(99,102,241,0.12)",
                    display: "flex", gap: 10, alignItems: "flex-end"
                  }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-accent)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Conducted Classes
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={calcTotal}
                        className="sa-modal-input"
                        onChange={e => setCalcTotal(parseInt(e.target.value, 10) || 0)}
                        style={{
                          width: "100%", padding: "8px 10px", background: "var(--color-surface-2)",
                          border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-sm)",
                          color: "var(--color-text-primary)", fontSize: 12, fontFamily: "inherit"
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-accent)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Percentage (%)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 75"
                        value={calcPercent}
                        className="sa-modal-input"
                        onChange={e => setCalcPercent(e.target.value)}
                        style={{
                          width: "100%", padding: "8px 10px", background: "var(--color-surface-2)",
                          border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-sm)",
                          color: "var(--color-text-primary)", fontSize: 12, fontFamily: "inherit"
                        }}
                      />
                    </div>
                    <button
                      onClick={handleApplyCalc}
                      style={{
                        padding: "8px 14px", background: "var(--color-accent)", color: "white",
                        border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, height: 33, transition: "filter 0.15s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.15)"}
                      onMouseLeave={e => e.currentTarget.style.filter = "none"}
                    >
                      Compute
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{
                  padding: "9px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjust}
                disabled={submittingAdjust}
                style={{
                  padding: "9px 18px", background: "var(--color-accent)", color: "white",
                  border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                  transition: "filter 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.15)"}
                onMouseLeave={e => e.currentTarget.style.filter = "none"}
              >
                {submittingAdjust ? "Saving..." : "Save Adjustments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Retroactive Attendance Modal ── */}
      {showRetroModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: "var(--color-surface-2)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--radius-lg)", padding: 24, maxWidth: 500,
            width: "100%", maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                Mark Attendance for {retroDateStr}
              </h3>
              <button
                onClick={() => setShowRetroModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-tertiary)" }}
              >✕</button>
            </div>

            {retroSlots.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-tertiary)" }}>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No classes scheduled on this weekday.</p>
                <p style={{ fontSize: 12 }}>Check your timetable configuration if you think this is a mistake.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                {retroSlots.map((slot, idx) => {
                  const isMarking = markingRetro[`${slot.subjectId}_${slot.slotIndex}`];
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 12, background: "var(--color-surface-3)",
                        border: "1px solid rgba(255,255,255,0.05)", borderRadius: "var(--radius-md)",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {slot.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontFamily: "monospace", background: "var(--color-surface-2)", padding: "1px 5px", borderRadius: 3, color: "var(--color-text-secondary)" }}>
                            {slot.code}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                            ⏰ {slot.time}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleMarkRetro(slot.subjectId, slot.slotIndex, slot.status === "present" ? "unmarked" : "present")}
                          disabled={isMarking}
                          title={slot.status === "present" ? "Unmark Present" : "Mark Present"}
                          style={{
                            width: 28, height: 28, borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                            background: slot.status === "present" ? "var(--color-success)" : "rgba(34,197,94,0.1)",
                            color: slot.status === "present" ? "white" : "var(--color-success)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s"
                          }}
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleMarkRetro(slot.subjectId, slot.slotIndex, slot.status === "absent" ? "unmarked" : "absent")}
                          disabled={isMarking}
                          title={slot.status === "absent" ? "Unmark Absent" : "Mark Absent"}
                          style={{
                            width: 28, height: 28, borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                            background: slot.status === "absent" ? "var(--color-danger)" : "rgba(239,68,68,0.1)",
                            color: slot.status === "absent" ? "white" : "var(--color-danger)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s"
                          }}
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRetroModal(false)}
                style={{
                  padding: "9px 20px", background: "var(--color-accent)", color: "white",
                  border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAttendanceView;