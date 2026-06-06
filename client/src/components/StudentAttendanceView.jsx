import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import {
  Calendar, Check, X, Flame, BarChart2, BookOpen, Clock,
  ChevronLeft, ChevronRight, ShieldAlert, Award,
  CalendarCheck, CheckCircle, XCircle, TrendingUp, BarChart3,
  Target, Users, AlertTriangle,
} from "lucide-react";
import EmptyState from "./EmptyState";

/* ─── design tokens (match StudentAI dashboard palette) ─── */
const T = {
  bg:       "#0d1117",
  surface:  "#161b2c",
  surface2: "#1c2236",
  surface3: "#222840",
  border:   "rgba(255,255,255,0.06)",
  border2:  "rgba(255,255,255,0.10)",
  accent:   "#6366f1",
  accentMuted: "rgba(99,102,241,0.12)",
  accentBorder:"rgba(99,102,241,0.28)",
  text:     "#e8ecf5",
  text2:    "#7b85a0",
  text3:    "#454e65",
  success:  "#22c55e",
  successM: "rgba(34,197,94,0.12)",
  danger:   "#f87171",
  dangerM:  "rgba(248,113,113,0.12)",
  warning:  "#f59e0b",
  warningM: "rgba(245,158,11,0.12)",
  info:     "#60a5fa",
  infoM:    "rgba(96,165,250,0.12)",
  radius:   "10px",
  radiusLg: "14px",
  radiusXl: "18px",
};

/* ─── tiny helpers ─── */
const pctColor  = (p) => p >= 75 ? T.success : p >= 50 ? T.warning : T.danger;
const pctMuted  = (p) => p >= 75 ? T.successM : p >= 50 ? T.warningM : T.dangerM;
const pctBorder = (p) => p >= 75 ? "rgba(34,197,94,0.25)" : p >= 50 ? "rgba(245,158,11,0.25)" : "rgba(248,113,113,0.25)";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ─── Icon badge (like the dashboard stat cards) ─── */
const IconBadge = ({ icon: Icon, color, muted, size = 18 }) => (
  <div style={{
    width: 40, height: 40, borderRadius: "10px",
    background: muted, display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }}>
    <Icon size={size} color={color} strokeWidth={1.8} />
  </div>
);

/* ─── Stat card (centered icon + colored value + label below — matches screenshot) ─── */
const StatCard = ({ label, value, icon: Icon, color, muted }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: T.radiusLg, padding: "24px 16px",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 10, textAlign: "center",
    transition: "border-color 0.18s, background 0.18s",
    cursor: "default",
  }}
    onMouseEnter={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.borderColor = T.border2; }}
    onMouseLeave={e => { e.currentTarget.style.background = T.surface;  e.currentTarget.style.borderColor = T.border;  }}
  >
    <IconBadge icon={Icon} color={color} muted={muted} />
    <div style={{ lineHeight: 1 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>{label}</div>
    </div>
  </div>
);

/* ─── Section header with colored dot — exactly like "Class Avg Attendance" header ─── */
const SectionHeader = ({ icon: Icon, color = T.accent, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
    <Icon size={14} color={color} strokeWidth={2} />
    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text, letterSpacing: "-0.1px" }}>{children}</span>
  </div>
);

/* ─── Smart insight banner ─── */
const Insight = ({ present, total }) => {
  if (!total) return null;
  const pct = (present / total) * 100;
  let cls, icon, text;
  if (pct >= 75) {
    const miss = Math.floor(present / 0.75 - total);
    cls = { bg: T.successM, border: "rgba(34,197,94,0.3)", color: T.success };
    icon = <CheckCircle size={11} strokeWidth={2} />;
    text = miss > 0
      ? `Safe · can miss up to ${miss} more class${miss > 1 ? "es" : ""}`
      : "Safe but tight — don't miss upcoming classes";
  } else {
    const need = Math.ceil((0.75 * total - present) / 0.25);
    cls = { bg: T.dangerM, border: "rgba(248,113,113,0.3)", color: T.danger };
    icon = <AlertTriangle size={11} strokeWidth={2} />;
    text = `Attend next ${need} consecutive class${need > 1 ? "es" : ""} to reach 75%`;
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      marginTop: 8, padding: "5px 10px", borderRadius: 6,
      background: cls.bg, border: `1px solid ${cls.border}`,
      color: cls.color, fontSize: 11, fontWeight: 500,
    }}>
      {icon}<span>{text}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════ */
const StudentAttendanceView = ({ sid }) => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [subjects,   setSubjects]   = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const [markForm, setMarkForm] = useState({
    subjectId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "present",
  });
  const [marking, setMarking] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sid ? fetchAttendance() : (setLoading(false), setError("Please update your Student ID (SID) in Profile Settings to track your attendance."));
  }, [sid]);

  useEffect(() => { setCurrentPage(1); }, [filter]);

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
    const sorted = [...records].filter(r => r.status !== "cancelled").sort((a, b) => new Date(b.date) - new Date(a.date));
    let s = 0;
    for (const r of sorted) { if (r.status === "present") s++; else break; }
    return s;
  };

  const filteredRecords = data?.records.filter(r => filter === "all" || r.status === filter) || [];
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const pageRecords = filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  /* ── loading ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{
        width: 36, height: 36, border: `3px solid ${T.border2}`,
        borderTopColor: T.accent, borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── error ── */
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.dangerM, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShieldAlert size={24} color={T.danger} strokeWidth={1.8} />
      </div>
      <p style={{ color: T.text2, fontSize: 14, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>{error}</p>
      {!sid && (
        <Link to="/profile" style={{
          padding: "9px 20px", background: T.accent, color: "#fff",
          borderRadius: T.radius, textDecoration: "none", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
        }}>
          Go to Profile Settings
        </Link>
      )}
    </div>
  );

  const stats         = getOverallStats();
  const overallStreak = getOverallStreak(data?.records);
  const donutR        = 54;
  const donutSW       = 9;
  const donutCirc     = 2 * Math.PI * donutR;
  const donutOffset   = donutCirc - (stats.percentage / 100) * donutCirc;

  const statCards = [
    { label: "Total Classes",   value: stats.total,      icon: Calendar,     color: T.info,    muted: T.infoM    },
    { label: "Present",         value: stats.present,    icon: CheckCircle,  color: T.success, muted: T.successM },
    { label: "Absent",          value: stats.absent,     icon: XCircle,      color: T.danger,  muted: T.dangerM  },
    { label: "Attendance",      value: `${stats.percentage}%`, icon: TrendingUp, color: pctColor(stats.percentage), muted: pctMuted(stats.percentage) },
  ];

  /* ─── Legend chip (like "≥75% · 50-74% · <50%") ─── */
  const LegendChip = ({ color, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.text2 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-warn {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50%      { box-shadow: 0 0 0 6px rgba(245,158,11,0.12); }
        }

        .sa-form-select, .sa-form-input {
          width: 100%; padding: 9px 12px;
          background: ${T.surface3}; border: 1px solid ${T.border};
          border-radius: ${T.radius}; color: ${T.text};
          font-size: 13px; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .sa-form-select:focus, .sa-form-input:focus { border-color: ${T.accent}; }
        .sa-form-select option { background: ${T.surface2}; }

        .sa-toggle { 
          flex: 1; padding: 9px 8px; border-radius: ${T.radius};
          border: 1px solid ${T.border2}; background: ${T.surface3};
          color: ${T.text2}; font-size: 13px; font-family: inherit;
          font-weight: 500; cursor: pointer; display: flex;
          align-items: center; justify-content: center; gap: 6px;
          transition: all 0.15s;
        }
        .sa-toggle.present { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); color: ${T.success}; }
        .sa-toggle.absent  { background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.35); color: ${T.danger};  }

        .sa-submit {
          width: 100%; padding: 11px; border: none; border-radius: ${T.radius};
          background: ${T.accent}; color: #fff; font-size: 13.5px; font-weight: 600;
          font-family: inherit; cursor: pointer; transition: opacity 0.15s;
          letter-spacing: 0.01em;
        }
        .sa-submit:hover:not(:disabled) { opacity: 0.88; }
        .sa-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .sa-filter-tab {
          background: none; border: none; padding: 7px 14px 9px;
          font-size: 12.5px; font-family: inherit; font-weight: 500;
          color: ${T.text3}; cursor: pointer; transition: color 0.15s;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          text-transform: capitalize;
        }
        .sa-filter-tab.active { color: ${T.text}; border-bottom-color: ${T.accent}; }
        .sa-filter-tab:hover:not(.active) { color: ${T.text2}; }

        .sa-pg-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 8px; font-size: 12px;
          font-family: inherit; font-weight: 500; cursor: pointer;
          border: 1px solid ${T.border2}; background: ${T.surface2};
          color: ${T.text2}; transition: all 0.15s;
        }
        .sa-pg-btn:hover:not(:disabled) { border-color: ${T.accent}; color: ${T.text}; }
        .sa-pg-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .sa-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 680px) {
          .sa-row { grid-template-columns: 1fr; }
          .sa-stat-row { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .sa-stat-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── STAT CARDS ── */}
      <div className="sa-stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── MARK FORM + DONUT ── */}
      <div className="sa-row">

        {/* Mark attendance card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: 22 }}>
          <SectionHeader icon={CalendarCheck} color={T.accent}>Mark today's class</SectionHeader>

          {subjects.length === 0 ? (
            <EmptyState
              illustration="default"
              title="No subjects added"
              subtitle="Add subjects in Timetable first to start tracking attendance."
            />
          ) : (
            <form onSubmit={handleMark} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Subject</label>
                <select
                  className="sa-form-select"
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
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Date</label>
                <input
                  type="date"
                  className="sa-form-input"
                  value={markForm.date}
                  onChange={e => setMarkForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>

              {/* Status toggle */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className={`sa-toggle ${markForm.status === "present" ? "present" : ""}`}
                    onClick={() => setMarkForm(p => ({ ...p, status: "present" }))}>
                    <Check size={13} strokeWidth={2.5} /> Present
                  </button>
                  <button type="button" className={`sa-toggle ${markForm.status === "absent" ? "absent" : ""}`}
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
        </div>

        {/* Overall donut */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <SectionHeader icon={BarChart2} color={T.accent}>Overall attendance</SectionHeader>
            {overallStreak >= 2 && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: T.warningM, border: `1px solid rgba(245,158,11,0.25)`,
                color: T.warning, fontSize: 11, fontWeight: 700,
                padding: "4px 10px", borderRadius: 999,
                animation: "pulse-warn 2.4s infinite",
              }}>
                <Flame size={12} fill={T.warning} />
                {overallStreak}-day streak
              </div>
            )}
          </div>

          {stats.total > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              {/* SVG Donut */}
              <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={130} height={130} style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
                  <defs>
                    <filter id="sa-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="4" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <circle cx={65} cy={65} r={donutR} fill="none" stroke={T.border2} strokeWidth={donutSW} />
                  <circle cx={65} cy={65} r={donutR} fill="none"
                    stroke={pctColor(stats.percentage)} strokeWidth={donutSW}
                    strokeDasharray={`${donutCirc} ${donutCirc}`}
                    strokeDashoffset={donutOffset}
                    strokeLinecap="round"
                    filter="url(#sa-glow)"
                    style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(.4,0,.2,1)" }}
                  />
                </svg>
                <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: pctColor(stats.percentage), letterSpacing: "-1px", lineHeight: 1 }}>
                    {stats.percentage}%
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
                    Attendance
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.text2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.success, boxShadow: `0 0 8px ${T.success}` }} />
                  Present <strong style={{ color: T.text }}>{stats.present}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.text2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.danger, boxShadow: `0 0 8px ${T.danger}` }} />
                  Absent <strong style={{ color: T.text }}>{stats.absent}</strong>
                </div>
              </div>

              {/* Insight banner */}
              <Insight present={stats.present} total={stats.total} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={22} color={T.accent} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>No records yet</div>
                <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.5 }}>Mark your first class to start tracking</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SUBJECT BREAKDOWN + RECORDS ── */}
      <div className="sa-row">

        {/* Subject breakdown */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: 22 }}>
          {/* Header with legend chips — exactly like "Class Avg Attendance" */}
          <div style={{ marginBottom: 16 }}>
            <SectionHeader icon={BookOpen} color={T.accent}>Subject breakdown</SectionHeader>
            <div style={{ display: "flex", gap: 14, marginTop: -8 }}>
              <LegendChip color={T.success} label="≥ 75%" />
              <LegendChip color={T.warning} label="50–74%" />
              <LegendChip color={T.danger}  label="< 50%" />
            </div>
          </div>

          {data.summary.filter(s => s.subject && s.subject !== "Unknown").length === 0 ? (
            <EmptyState
              illustration="attendance"
              title="No records found"
              subtitle="Mark attendance above to see your subject-wise breakdown."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.summary
                .filter(s => s.subject && s.subject !== "Unknown")
                .map(subject => {
                  const streak = getSubjectStreak(subject.code);
                  const bc = pctColor(subject.percentage);

                  return (
                    <div key={subject.code} style={{
                      background: T.surface2, border: `1px solid ${T.border}`,
                      borderRadius: T.radius, padding: "12px 14px",
                      transition: "border-color 0.15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = T.border2}
                      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                    >
                      {/* Row 1: name, code, streak, ratio, pct */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {subject.subject}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: T.text3,
                          background: T.surface3, border: `1px solid ${T.border2}`,
                          padding: "2px 7px", borderRadius: 5, fontFamily: "monospace", whiteSpace: "nowrap",
                        }}>{subject.code}</span>
                        {streak >= 2 && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            fontSize: 10, fontWeight: 700, color: T.warning,
                            background: T.warningM, border: `1px solid rgba(245,158,11,0.2)`,
                            padding: "2px 7px", borderRadius: 5,
                          }}>
                            <Flame size={9} fill={T.warning} /> {streak}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: T.text3, whiteSpace: "nowrap" }}>{subject.present}/{subject.total}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: bc, whiteSpace: "nowrap" }}>{subject.percentage}%</span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${subject.percentage}%`,
                          background: bc, borderRadius: 99,
                          transition: "width 0.45s cubic-bezier(.4,0,.2,1)",
                        }} />
                      </div>

                      <Insight present={subject.present} total={subject.total} />
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Attendance records */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: 22 }}>
          <SectionHeader icon={Calendar} color={T.accent}>Attendance records</SectionHeader>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 14 }}>
            {["all", "present", "absent"].map(f => (
              <button key={f} className={`sa-filter-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>{f}</button>
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
                      fontSize: 10.5, fontWeight: 600, color: T.text3,
                      textTransform: "uppercase", letterSpacing: "0.07em",
                      borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRecords.length > 0 ? pageRecords.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.028)`, transition: "background 0.12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.016)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "9px 10px", fontSize: 12, color: T.text2, whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 600, color: T.text }}>{r.subject}</td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{
                        fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: T.text3,
                        background: T.surface3, border: `1px solid ${T.border}`,
                        padding: "2px 7px", borderRadius: 5,
                      }}>{r.code}</span>
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.status === "present" ? T.successM : T.dangerM,
                        color:      r.status === "present" ? T.success  : T.danger,
                        border:     `1px solid ${r.status === "present" ? "rgba(34,197,94,0.22)" : "rgba(248,113,113,0.22)"}`,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: r.status === "present" ? T.success : T.danger,
                        }} />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 32, fontSize: 13, color: T.text3 }}>
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <button className="sa-pg-btn" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <ChevronLeft size={13} /> Prev
              </button>
              <span style={{ fontSize: 11, color: T.text3, fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button className="sa-pg-btn" disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAttendanceView;