import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import {
  Calendar, Check, X, Flame, BookOpen,
  ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck,
  CalendarCheck, CheckCircle, XCircle,
  AlertTriangle, CalendarDays, ClipboardList,
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
  <div style={{
    background: "var(--color-surface-2)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
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

  /* ── quick mark (from TodayScheduleCard) ── */
  const handleQuickMark = async (subjectId, date, status, slot) => {
    // TodayScheduleCard already reflects the mark optimistically and rolls back
    // on throw, so surface errors and refresh only the attendance records
    // (not the timetable) to reconcile.
    try {
      await API.post(`/attendance`, { subjectId, date, status, slot });
      toast.success(`Marked ${status}!`);
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
  const todayDate = new Date().toISOString().slice(0, 10);

  /* Card 1 — Classes Today: count from timetable schedule, not marked records */
  const classesToday = todayClasses.length;

  /* Card 2 — Can Still Miss */
  const presentCount  = data?.records?.filter(r => r.status === "present").length || 0;
  const absentCount   = data?.records?.filter(r => r.status === "absent").length || 0;
  const totalClasses  = presentCount + absentCount;
  const rawMaxMiss    = totalClasses > 0 ? Math.floor(presentCount / 0.75 - totalClasses) : 0;
  const canStillMiss  = Math.max(0, rawMaxMiss);
  const canMissColor  = rawMaxMiss <= 0 ? "var(--color-danger)" : rawMaxMiss <= 3 ? "var(--color-warning)" : "var(--color-success)";
  const canMissMuted  = rawMaxMiss <= 0 ? "var(--color-danger-muted)" : rawMaxMiss <= 3 ? "var(--color-warning-muted)" : "var(--color-success-muted)";

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
  (data?.records?.filter(r => new Date(r.date).toISOString().slice(0, 10) === todayDate) || []).forEach(r => {
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
      subLabel: "before 75% drops",
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <style>{`
        @keyframes sa-spin { to { transform: rotate(360deg); } }

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
        }
        .sa-sub-card:hover { border-color: rgba(255,255,255,0.10); }

        .sa-2col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .sa-4col { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }

        @media (max-width: 700px) {
          .sa-4col { grid-template-columns: 1fr 1fr; }
          .sa-2col { grid-template-columns: 1fr; }
        }
        @media (max-width: 400px) {
          .sa-4col { grid-template-columns: 1fr; }
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
        <MonthlyCalendarCard records={data.records} />
      </div>

      {/* ── SUBJECT BREAKDOWN + RECORDS ── */}
      <div className="sa-2col">

        {/* Subject breakdown */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <SectionHeader icon={BookOpen}>Subject breakdown</SectionHeader>
            <div style={{ display: "flex", gap: "var(--space-4)", marginTop: -8 }}>
              <LegendChip colorVar="var(--color-success)" label="≥ 75%" />
              <LegendChip colorVar="var(--color-warning)" label="50–74%" />
              <LegendChip colorVar="var(--color-danger)"  label="< 50%" />
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
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {subject.subject}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)",
                          background: "var(--color-surface-2)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          padding: "2px 7px", borderRadius: "var(--radius-sm)",
                          fontFamily: "monospace", whiteSpace: "nowrap",
                        }}>{subject.code}</span>
                        {streak >= 2 && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            fontSize: 10, fontWeight: 700, color: "var(--color-warning)",
                            background: "var(--color-warning-muted)",
                            border: "1px solid rgba(245,158,11,0.2)",
                            padding: "2px 7px", borderRadius: "var(--radius-sm)",
                          }}>
                            <Flame size={9} fill="var(--color-warning)" /> {streak}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
                          {subject.present}/{subject.total}
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: col, whiteSpace: "nowrap" }}>
                          {subject.percentage}%
                        </span>
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

          <div style={{ overflowX: "auto" }}>
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
    </div>
  );
};

export default StudentAttendanceView;