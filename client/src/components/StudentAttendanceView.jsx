import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import {
  Calendar, Check, X, Flame, BarChart2, BookOpen,
  ChevronLeft, ChevronRight, ShieldAlert,
  CalendarCheck, CheckCircle, XCircle, TrendingUp, BarChart3,
  AlertTriangle,
} from "lucide-react";
import EmptyState from "./EmptyState";

/* ─── helpers (pure logic, no colors) ─── */
const pctColorVar  = (p) => p >= 75 ? "var(--color-success)"        : p >= 50 ? "var(--color-warning)"        : "var(--color-danger)";
const pctMutedVar  = (p) => p >= 75 ? "var(--color-success-muted)"  : p >= 50 ? "var(--color-warning-muted)"  : "var(--color-danger-muted)";
const pctBorderVar = (p) => p >= 75 ? "rgba(16,185,129,0.25)"       : p >= 50 ? "rgba(245,158,11,0.25)"       : "rgba(239,68,68,0.25)";

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
const StatCard = ({ label, value, icon: Icon, colorVar, mutedVar }) => (
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
      <div style={{ fontSize: 28, fontWeight: 700, color: colorVar, letterSpacing: "-0.5px" }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6,
      }}>
        {label}
      </div>
    </div>
  </div>
);

/* ─── Section header with dot + icon ─── */
const SectionHeader = ({ icon: Icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: "var(--color-accent)", flexShrink: 0,
    }} />
    <Icon size={14} color="var(--color-accent)" strokeWidth={2} />
    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.1px" }}>
      {children}
    </span>
  </div>
);

/* ─── Smart insight banner ─── */
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

/* ═══════════════════════════════════════════════════════ */
const StudentAttendanceView = ({ sid }) => {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [filter,      setFilter]      = useState("all");
  const [subjects,    setSubjects]    = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const [markForm, setMarkForm] = useState({
    subjectId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "present",
  });
  const [marking, setMarking] = useState(false);

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

  useEffect(() => {
    sid ? fetchAttendance() : (setLoading(false), setError("Please update your Student ID (SID) in Profile Settings to track your attendance."));
  }, [sid]);

  useEffect(() => { setCurrentPage(1); }, [filter]);

  /* ── mark ── */
  const handleMark = async (e) => {
    e.preventDefault();
    if (!markForm.subjectId) { toast.error("Please select a subject."); return; }
    setMarking(true);
    try {
      await API.post(`/attendance`, markForm);
      toast.success("Attendance marked!");
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark attendance.");
    } finally { setMarking(false); }
  };

  /* ── stats ── */
  const getOverallStats = () => {
    if (!data) return { present: 0, absent: 0, total: 0, percentage: 0 };
    const present = data.records.filter(r => r.status === "present").length;
    const absent  = data.records.filter(r => r.status === "absent").length;
    const total   = present + absent;
    return { present, absent, total, percentage: total > 0 ? Math.round(present / total * 100) : 0 };
  };

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

  const getOverallStreak = (records) => {
    if (!records?.length) return 0;
    const sorted = [...records]
      .filter(r => r.status !== "cancelled")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    let s = 0;
    for (const r of sorted) { if (r.status === "present") s++; else break; }
    return s;
  };

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
      <p style={{
        color: "var(--color-text-secondary)", fontSize: 14,
        textAlign: "center", maxWidth: 380, lineHeight: 1.6,
      }}>{error}</p>
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

  /* ── derived ── */
  const stats         = getOverallStats();
  const overallStreak = getOverallStreak(data?.records);

  /* SVG donut */
  const donutR    = 54;
  const donutSW   = 9;
  const donutCirc = 2 * Math.PI * donutR;
  const donutOff  = donutCirc - (stats.percentage / 100) * donutCirc;

  const statCards = [
    { label: "Total Classes", value: stats.total,              icon: Calendar,    colorVar: "var(--color-indigo-light)", mutedVar: "var(--color-accent-muted)" },
    { label: "Present",       value: stats.present,            icon: CheckCircle, colorVar: "var(--color-success)",      mutedVar: "var(--color-success-muted)" },
    { label: "Absent",        value: stats.absent,             icon: XCircle,     colorVar: "var(--color-danger)",       mutedVar: "var(--color-danger-muted)"  },
    { label: "Attendance",    value: `${stats.percentage}%`,   icon: TrendingUp,  colorVar: pctColorVar(stats.percentage), mutedVar: pctMutedVar(stats.percentage) },
  ];

  const LegendChip = ({ colorVar, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: colorVar, flexShrink: 0 }} />
      {label}
    </div>
  );

  /* ── card shell ── */
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <style>{`
        @keyframes sa-spin { to { transform: rotate(360deg); } }
        @keyframes sa-pulse-warn {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0.10); }
        }

        .sa-select, .sa-input {
          width: 100%;
          padding: 9px 12px;
          background: var(--color-surface-3);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: var(--radius-md);
          color: var(--color-text-primary);
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .sa-select:focus, .sa-input:focus {
          border-color: var(--color-accent);
        }
        .sa-select option { background: var(--color-surface-2); }

        .sa-toggle {
          flex: 1; padding: 9px 8px;
          border-radius: var(--radius-md);
          border: 1px solid rgba(255,255,255,0.08);
          background: var(--color-surface-3);
          color: var(--color-text-secondary);
          font-size: 13px; font-family: inherit; font-weight: 500;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.15s;
        }
        .sa-toggle.is-present {
          background: var(--color-success-muted);
          border-color: rgba(16,185,129,0.32);
          color: var(--color-success);
        }
        .sa-toggle.is-absent {
          background: var(--color-danger-muted);
          border-color: rgba(239,68,68,0.32);
          color: var(--color-danger);
        }

        .sa-submit {
          width: 100%; padding: 11px;
          border: none; border-radius: var(--radius-md);
          background: var(--color-accent); color: #fff;
          font-size: 13.5px; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: opacity 0.15s; letter-spacing: 0.01em;
        }
        .sa-submit:hover:not(:disabled) { opacity: 0.87; }
        .sa-submit:disabled { opacity: 0.50; cursor: not-allowed; }

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

        .sa-tr { border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.12s; }
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

      {/* ── MARK FORM + DONUT ── */}
      <div className="sa-2col">

        {/* Mark attendance */}
        <Card>
          <SectionHeader icon={CalendarCheck}>Mark today's class</SectionHeader>

          {subjects.length === 0 ? (
            <EmptyState
              illustration="default"
              title="No subjects added"
              subtitle="Add subjects in Timetable first to start tracking attendance."
            />
          ) : (
            <form onSubmit={handleMark} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

              {/* Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Subject
                </label>
                <select
                  className="sa-select"
                  value={markForm.subjectId}
                  onChange={e => setMarkForm(p => ({ ...p, subjectId: e.target.value }))}
                  required
                >
                  <option value="">Select subject…</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Date
                </label>
                <input
                  type="date"
                  className="sa-input"
                  value={markForm.date}
                  onChange={e => setMarkForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>

              {/* Status toggle */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Status
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button type="button"
                    className={`sa-toggle ${markForm.status === "present" ? "is-present" : ""}`}
                    onClick={() => setMarkForm(p => ({ ...p, status: "present" }))}>
                    <Check size={13} strokeWidth={2.5} /> Present
                  </button>
                  <button type="button"
                    className={`sa-toggle ${markForm.status === "absent" ? "is-absent" : ""}`}
                    onClick={() => setMarkForm(p => ({ ...p, status: "absent" }))}>
                    <X size={13} strokeWidth={2.5} /> Absent
                  </button>
                </div>
              </div>

              <button type="submit" className="sa-submit" disabled={marking}>
                {marking ? "Saving…" : "Submit record"}
              </button>
            </form>
          )}
        </Card>

        {/* Overall donut */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <SectionHeader icon={BarChart2}>Overall attendance</SectionHeader>
            {overallStreak >= 2 && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "var(--color-warning-muted)",
                border: "1px solid rgba(245,158,11,0.22)",
                color: "var(--color-warning)",
                fontSize: 11, fontWeight: 700,
                padding: "4px 10px", borderRadius: "var(--radius-pill)",
                animation: "sa-pulse-warn 2.4s infinite",
              }}>
                <Flame size={12} fill="var(--color-warning)" />
                {overallStreak}-day streak
              </div>
            )}
          </div>

          {stats.total > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-5)" }}>
              {/* Donut */}
              <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={130} height={130} style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
                  <circle cx={65} cy={65} r={donutR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={donutSW} />
                  <circle cx={65} cy={65} r={donutR} fill="none"
                    stroke={pctColorVar(stats.percentage)}
                    strokeWidth={donutSW}
                    strokeDasharray={`${donutCirc} ${donutCirc}`}
                    strokeDashoffset={donutOff}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(.4,0,.2,1)" }}
                  />
                </svg>
                <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: pctColorVar(stats.percentage), letterSpacing: "-1px", lineHeight: 1 }}>
                    {stats.percentage}%
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
                    Attendance
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "var(--space-5)" }}>
                {[
                  { dot: "var(--color-success)", label: "Present", val: stats.present },
                  { dot: "var(--color-danger)",  label: "Absent",  val: stats.absent  },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--color-text-secondary)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.dot, flexShrink: 0 }} />
                    {l.label} <strong style={{ color: "var(--color-text-primary)" }}>{l.val}</strong>
                  </div>
                ))}
              </div>

              <Insight present={stats.present} total={stats.total} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: "var(--space-3)", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={22} color="var(--color-accent)" strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>No records yet</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Mark your first class to start tracking</div>
              </div>
            </div>
          )}
        </Card>
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
                      {/* Row */}
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

                      {/* Progress bar */}
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

          {/* Filter tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "var(--space-4)" }}>
            {["all", "present", "absent"].map(f => (
              <button key={f}
                className={`sa-ftab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          {/* Table */}
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

          {/* Pagination */}
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