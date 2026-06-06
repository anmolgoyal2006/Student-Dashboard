import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import { 
  Calendar, Check, X, Flame, BarChart2, BookOpen, Clock, 
  ChevronLeft, ChevronRight, User, Mail, ShieldAlert, Award,
  CalendarDays, CheckCircle, XCircle, TrendingUp, CalendarCheck, BarChart3
} from "lucide-react";
import EmptyState from "./EmptyState";

const StudentAttendanceView = ({ sid }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [subjects, setSubjects] = useState([]);
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
      setLoading(true);
      setError(null);
      const [attendanceRes, subjectsRes] = await Promise.all([
        API.get(`/attendance/student/${sid}`),
        API.get(`/timetable`),
      ]);
      setData(attendanceRes.data);
      setSubjects(subjectsRes.data.subjects || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sid) {
      fetchAttendance();
    } else {
      setLoading(false);
      setError("Please update your Student ID (SID) in Profile Settings to track your attendance.");
    }
  }, [sid]);

  // Reset page to 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const handleMark = async (e) => {
    e.preventDefault();
    if (!markForm.subjectId) { 
      toast.error("Please select a subject."); 
      return; 
    }
    setMarking(true);
    try {
      await API.post(`/attendance`, markForm);
      toast.success("Attendance marked!");
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark attendance.");
    } finally {
      setMarking(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  const getStrokeGradient = (pct) => {
    if (pct >= 75) return "url(#successGrad)";
    if (pct >= 50) return "url(#warningGrad)";
    return "url(#dangerGrad)";
  };

  const getThemeVars = (colorHex, rgbStr) => ({
    '--theme-color': colorHex,
    '--theme-bg-muted': `rgba(${rgbStr}, 0.08)`,
    '--theme-border': `rgba(${rgbStr}, 0.15)`,
    '--theme-border-hover': `rgba(${rgbStr}, 0.35)`,
    '--theme-radial-color': `rgba(${rgbStr}, 0.04)`,
    '--theme-shadow-glow': `0 8px 20px rgba(${rgbStr}, 0.1)`,
    '--theme-color-glow': `rgba(${rgbStr}, 0.25)`
  });

  const getStudentStanding = (pct) => {
    if (pct >= 75) return { text: "Good Standing", className: "premium-standing-excellent", icon: Award };
    if (pct >= 50) return { text: "Needs Attention", className: "premium-standing-warning", icon: Flame };
    return { text: "Critical Status", className: "premium-standing-critical", icon: ShieldAlert };
  };

  const getOverallStats = () => {
    if (!data) return { present: 0, absent: 0, total: 0, percentage: 0 };
    const present = data.records.filter((r) => r.status === "present").length;
    const absent = data.records.filter((r) => r.status === "absent").length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, percentage };
  };

  const getSubjectStreak = (subjectCode) => {
    if (!data || !data.records) return 0;
    const subRecords = data.records
      .filter((r) => r.code === subjectCode && r.status !== "cancelled")
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let streak = 0;
    for (let i = subRecords.length - 1; i >= 0; i--) {
      if (subRecords[i].status === "present") {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const getOverallStreak = (records) => {
    if (!records || records.length === 0) return 0;
    const sorted = [...records]
      .filter(r => r.status !== 'cancelled')
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // descending (newest first)
    
    let streak = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].status === 'present') {
        streak++;
      } else if (sorted[i].status === 'absent') {
        break; // streak broken
      }
    }
    return streak;
  };

  const getSmartInsight = (present, total) => {
    if (total === 0) return { status: 'no_data', text: 'No attendance records yet.' };
    const percentage = (present / total) * 100;
    if (percentage >= 75) {
      const maxMiss = Math.floor(present / 0.75 - total);
      if (maxMiss > 0) {
        return {
          status: 'safe',
          text: `Safe. You can miss up to ${maxMiss} class${maxMiss > 1 ? 'es' : ''} without dropping below 75%.`
        };
      } else {
        return {
          status: 'warning',
          text: `Safe, but tight. You cannot miss any upcoming classes without dropping below 75%.`
        };
      }
    } else {
      const needed = Math.ceil((0.75 * total - present) / 0.25);
      return {
        status: 'danger',
        text: `Critical. Attend the next ${needed} consecutive class${needed > 1 ? 'es' : ''} to reach 75%.`
      };
    }
  };

  const filteredRecords = data?.records.filter((r) =>
    filter === "all" ? true : r.status === filter
  ) || [];

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const pageRecords = filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  const barColor = (pct) =>
    pct >= 75 ? "var(--color-success)" : pct >= 50 ? "var(--color-warning)" : "var(--color-danger)";

  if (loading) return <div className="spinner" />;

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: "1rem" }}>
      <ShieldAlert size={40} color="var(--color-danger)" />
      <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", textAlign: "center", maxWidth: "400px", lineHeight: "1.4" }}>{error}</p>
      {!sid && (
        <Link to="/profile" style={{
          marginTop: "0.5rem",
          padding: "0.6rem 1.2rem",
          background: "var(--color-accent)",
          color: "var(--color-text-primary)",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontWeight: 500,
          fontSize: "0.85rem",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
          transition: "transform 0.2s, opacity 0.2s"
        }}>
          Go to Profile Settings
        </Link>
      )}
    </div>
  );

  const stats = getOverallStats();
  const overallStreak = getOverallStreak(data?.records);
  const standing = getStudentStanding(stats.percentage);
  const StandingIcon = standing.icon;

  // SVG Donut metrics
  const radius = 60;
  const strokeWidth = 8;
  const r = radius - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (stats.percentage / 100) * circ;

  const getAttendanceColor = (pct) => {
    if (pct >= 75) return "var(--color-success)";
    if (pct >= 50) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const statCards = [
    { label: "Total classes", value: stats.total, color: "var(--color-accent)" },
    { label: "Present", value: stats.present, color: "var(--color-success)" },
    { label: "Absent", value: stats.absent, color: "var(--color-danger)" },
    { label: "Attendance %", value: `${stats.percentage}%`, color: getAttendanceColor(stats.percentage) },
  ];

  return (
    <div>
      <style>{`
        .attendance-sub-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          gap: 12px;
        }
        .attendance-sub-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .attendance-sub-name {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 480px) {
          .attendance-sub-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
          .attendance-sub-left {
            width: 100%;
            flex-wrap: wrap;
          }
          .attendance-sub-name {
            white-space: normal;
            width: 100%;
          }
          .attendance-sub-right {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-top: 2px;
          }
        }

        /* FORM INPUTS & SELECTS */
        .form-select-premium, .form-input-premium {
          padding: 10px 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-md);
          font-size: 13px;
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.02);
          transition: all 0.2s ease;
          width: 100%;
          font-family: inherit;
        }
        .form-select-premium:focus, .form-input-premium:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          background: rgba(255, 255, 255, 0.04);
        }
        .form-select-premium:hover, .form-input-premium:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
        }

        /* PULSING STREAK BADGE */
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
            transform: scale(1.03);
          }
        }
        .pulsing-streak-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          color: var(--color-warning);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          animation: pulse-glow 2s infinite ease-in-out;
        }

        /* SUBJECT SUMMARY CARDS & PROGRESS BARS */
        .subject-summary-card {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-md);
          padding: 14px;
          transition: all 0.2s ease;
        }
        .subject-summary-card:hover {
          background: rgba(255, 255, 255, 0.025);
          border-color: rgba(255, 255, 255, 0.06);
        }
        .progress-bar-gradient-success { background: linear-gradient(90deg, var(--color-success), var(--color-success)); }
        .progress-bar-gradient-warning { background: linear-gradient(90deg, var(--color-warning), var(--color-warning)); }
        .progress-bar-gradient-danger { background: linear-gradient(90deg, var(--color-danger), var(--color-danger)); }

        .insight-banner-premium {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 11.5px;
          font-weight: 500;
          margin-top: 8px;
          border-left: 3px solid var(--insight-accent);
          background: var(--insight-bg);
          color: var(--insight-color);
        }

        /* TABLE STYLING */
        .table-th-premium {
          text-align: left;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .table-tr-premium {
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: background-color 0.15s ease;
        }
        .table-tr-premium:hover {
          background-color: rgba(255, 255, 255, 0.015);
        }
        .table-td-premium {
          padding: 10px 14px;
          font-size: 13px;
        }

        /* STATUS BADGES */
        .record-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .record-status-badge.present {
          background: rgba(16, 185, 129, 0.08);
          color: var(--color-success);
          border: 1px solid rgba(16, 185, 129, 0.15);
        }
        .record-status-badge.absent {
          background: rgba(239, 68, 68, 0.08);
          color: var(--color-danger);
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .status-dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-dot-pulse.present {
          background: var(--color-success);
          box-shadow: 0 0 6px var(--color-success);
        }
        .status-dot-pulse.absent {
          background: var(--color-danger);
          box-shadow: 0 0 6px var(--color-danger);
        }

        /* PAGINATION BUTTONS */
        .pagination-btn-premium {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .pagination-btn-premium:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-primary);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-0.5px);
        }
        .pagination-btn-premium:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {statCards.map((s) => {
          return (
            <div 
              key={s.label}
              style={{
                background: "var(--color-surface-2)",
                borderTop: `3px solid ${s.color}`,
                borderLeft: "1px solid rgba(255, 255, 255, 0.04)",
                borderRight: "1px solid rgba(255, 255, 255, 0.04)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                transition: "background-color 0.2s ease, transform 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
              }}
            >
              <div style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-text-tertiary)",
                fontWeight: 600
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: "36px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                lineHeight: 1
              }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider line between stats and mark card */}
      <div style={{ borderBottom: '0.5px solid rgba(255, 255, 255, 0.08)', marginBottom: 16 }} />

      {/* Mark attendance & Overall Ring */}
      <div className="grid-2 mb-4" style={{ gap: 16 }}>
        
        {/* Mark Attendance Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid rgba(99, 102, 241, 0.2)", padding: 20 }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '16px', fontWeight: 500 }}>
              <CalendarCheck size={16} color="var(--color-accent)" />
              Mark today's class
            </div>
            
            {subjects.length === 0 ? (
              <EmptyState
                illustration="default"
                title="No subjects added"
                subtitle="Add subjects in Timetable page first to start tracking attendance."
              />
            ) : (
              <form onSubmit={handleMark}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Subject */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Subject</label>
                    <select
                      className="form-select-premium"
                      value={markForm.subjectId}
                      onChange={(e) => setMarkForm((p) => ({ ...p, subjectId: e.target.value }))}
                      required
                      style={{
                        height: 44,
                        background: "var(--color-surface-3)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "var(--radius-md)"
                      }}
                    >
                      <option value="" style={{ background: 'var(--color-surface-2)' }}>Select subject…</option>
                      {subjects.map((s) => (
                        <option key={s._id} value={s._id} style={{ background: 'var(--color-surface-2)' }}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Status Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {/* Date */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Date</label>
                      <input
                        type="date"
                        className="form-input-premium"
                        value={markForm.date}
                        onChange={(e) => setMarkForm((p) => ({ ...p, date: e.target.value }))}
                        style={{
                          height: 44,
                          background: "var(--color-surface-3)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "var(--radius-md)"
                        }}
                      />
                    </div>

                    {/* Status Toggle Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Status</label>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setMarkForm(p => ({ ...p, status: 'present' }))}
                          style={{
                            width: 130,
                            height: 44,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13.5,
                            fontWeight: markForm.status === 'present' ? 500 : 400,
                            background: markForm.status === 'present' ? 'var(--color-success)' : 'var(--color-surface-3)',
                            color: markForm.status === 'present' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <Check size={14} />
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkForm(p => ({ ...p, status: 'absent' }))}
                          style={{
                            width: 130,
                            height: 44,
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13.5,
                            fontWeight: markForm.status === 'absent' ? 500 : 400,
                            background: markForm.status === 'absent' ? 'var(--color-danger)' : 'var(--color-surface-3)',
                            color: markForm.status === 'absent' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <X size={14} />
                          Absent
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={marking}
                    className="btn"
                    style={{
                      width: "100%",
                      marginTop: 8,
                      background: "var(--color-accent)",
                      color: "var(--color-text-primary)",
                      height: 48,
                      borderRadius: "var(--radius-md)",
                      fontSize: "15px",
                      fontWeight: 500,
                      boxShadow: "0 4px 16px rgba(99, 102, 241, 0.2)",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {marking ? (
                      <>
                        <span className="spinner-small" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite', marginRight: 6 }} />
                        Saving…
                      </>
                    ) : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Overall SVG Donut Chart Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: 20 }}>
          
          {/* Top Row: Title + Streak */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'absolute', top: 18, padding: '0 20px' }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: '16px', fontWeight: 500 }}>
              <BarChart2 size={18} color="var(--color-accent)" />
              Overall attendance
            </div>
            {overallStreak >= 2 && (
              <div className="pulsing-streak-badge">
                <Flame size={13} fill="var(--color-warning)" style={{ filter: 'drop-shadow(0 0 2px rgba(251,191,36,0.5))' }} />
                <span>{overallStreak}-day streak</span>
              </div>
            )}
          </div>

          {stats.total > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
              <div style={{ position: "relative", height: 130, width: 130, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                  <defs>
                    <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-success)" />
                      <stop offset="100%" stopColor="var(--color-success)" />
                    </linearGradient>
                    <linearGradient id="warningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-warning)" />
                      <stop offset="100%" stopColor="var(--color-warning)" />
                    </linearGradient>
                    <linearGradient id="dangerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-danger)" />
                      <stop offset="100%" stopColor="var(--color-danger)" />
                    </linearGradient>
                    <filter id="svgGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <circle
                    stroke="rgba(255, 255, 255, 0.03)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={r}
                    cx={radius}
                    cy={radius}
                  />
                  <circle
                    stroke={getStrokeGradient(stats.percentage)}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circ} ${circ}`}
                    style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.35s' }}
                    strokeLinecap="round"
                    filter="url(#svgGlow)"
                    r={r}
                    cx={radius}
                    cy={radius}
                  />
                </svg>
                <div style={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    {stats.percentage}%
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                    Attendance
                  </span>
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)", boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Present: <strong style={{ color: 'var(--color-text-primary)' }}>{stats.present}</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-danger)", boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Absent: <strong style={{ color: 'var(--color-text-primary)' }}>{stats.absent}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 220, padding: '24px 0', textAlign: 'center', width: '100%' }}>
              <BarChart3 size={40} color="var(--color-accent)" style={{ opacity: 0.4, marginBottom: 12 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 6px 0' }}>No records yet</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0', maxWidth: 260, lineHeight: 1.4 }}>
                Mark your first class above to start tracking
              </p>
              
              {/* Visual Placeholder Bars */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'center', marginTop: 8 }}>
                <div style={{ width: 16, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
                <div style={{ width: 16, height: 65, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
                <div style={{ width: 16, height: 50, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-column: breakdown + records */}
      <div className="grid-2" style={{ gap: 16 }}>

        {/* Subject breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '16px', fontWeight: 500 }}>
            <BookOpen size={18} color="var(--color-accent)" />
            Subject-wise summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {data.summary.filter((s) => s.subject && s.subject !== "Unknown").length === 0 ? (
              <EmptyState
                illustration="attendance"
                title="No records found"
                subtitle="Mark attendance above to see your subject-wise breakdown."
              />
            ) : (
              data.summary
                .filter((s) => s.subject && s.subject !== "Unknown")
                .map((subject) => {
                  const streak = getSubjectStreak(subject.code);
                  const insight = getSmartInsight(subject.present, subject.total);
                  const barCol = barColor(subject.percentage);
                  
                  const barGradClass = subject.percentage >= 75 
                    ? "progress-bar-gradient-success" 
                    : subject.percentage >= 50 
                      ? "progress-bar-gradient-warning" 
                      : "progress-bar-gradient-danger";
                  
                  const insightVars = insight.status === 'safe'
                    ? { '--insight-accent': 'var(--color-success)', '--insight-bg': 'rgba(16, 185, 129, 0.04)', '--insight-color': 'var(--color-success)', icon: Check }
                    : insight.status === 'warning'
                      ? { '--insight-accent': 'var(--color-warning)', '--insight-bg': 'rgba(245, 158, 11, 0.04)', '--insight-color': 'var(--color-warning)', icon: Flame }
                      : { '--insight-accent': 'var(--color-danger)', '--insight-bg': 'rgba(239, 68, 68, 0.04)', '--insight-color': 'var(--color-danger)', icon: ShieldAlert };
                  const InsightIcon = insightVars.icon;

                  return (
                    <div key={subject.code || subject.subject} className="subject-summary-card">
                      <div className="attendance-sub-header">
                        <div className="attendance-sub-left">
                          <span className="attendance-sub-name" title={subject.subject}>
                            {subject.subject}
                          </span>
                          <span style={{
                            fontSize: "10px", color: "var(--color-text-secondary)",
                            background: "rgba(255,255,255,0.04)",
                            padding: "2px 6px", borderRadius: 4,
                            fontWeight: 600,
                          }}>
                            {subject.code}
                          </span>
                          {streak >= 2 && (
                            <span style={{
                              fontSize: "10px",
                              background: "rgba(245,158,11,0.08)",
                              color: "var(--color-warning)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              border: "1px solid rgba(245,158,11,0.15)"
                            }}>
                              <Flame size={10} fill="var(--color-warning)" /> {streak} Streak
                            </span>
                          )}
                        </div>
                        <div className="attendance-sub-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11.5px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                            {subject.present}/{subject.total}
                          </span>
                          <span style={{
                            fontSize: "13.5px", fontWeight: 700, minWidth: 36,
                            textAlign: "right", color: barCol,
                          }}>
                            {subject.percentage}%
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: "100%", height: 6,
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "var(--radius-pill)", overflow: "hidden",
                        marginBottom: "4px"
                      }}>
                        <div 
                          className={barGradClass}
                          style={{
                            height: "100%", borderRadius: "var(--radius-pill)",
                            width: `${subject.percentage}%`,
                            transition: "width 0.4s ease",
                          }} 
                        />
                      </div>
                      <div className="insight-banner-premium" style={{
                        '--insight-accent': insightVars['--insight-accent'],
                        '--insight-bg': insightVars['--insight-bg'],
                        '--insight-color': insightVars['--insight-color']
                      }}>
                        <InsightIcon size={12} />
                        <span>{insight.text}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Attendance records */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '16px', fontWeight: 500 }}>
            <Calendar size={18} color="var(--color-accent)" />
            Attendance records
          </div>

          {/* Underline Tab Style Filters */}
          <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border)", marginBottom: "16px", marginTop: "12px" }}>
            {["all", "present", "absent"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: filter === f ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: filter === f ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  padding: "8px 4px",
                  fontSize: "13px",
                  fontWeight: filter === f ? 500 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textTransform: "capitalize"
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.01)" }}>
                  {["Date", "Subject", "Code", "Status"].map((h) => (
                    <th key={h} className="table-th-premium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRecords.length > 0 ? (
                  pageRecords.map((record, idx) => (
                    <tr key={idx} className="table-tr-premium">
                      <td className="table-td-premium" style={{
                        color: "var(--color-text-secondary)", fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}>
                        {formatDate(record.date)}
                      </td>
                      <td className="table-td-premium" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                        {record.subject}
                      </td>
                      <td className="table-td-premium" style={{ color: "var(--color-text-secondary)", fontSize: "12px", fontWeight: 500 }}>
                        <span style={{ background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                          {record.code}
                        </span>
                      </td>
                      <td className="table-td-premium">
                        <span className={`record-status-badge ${record.status}`}>
                          <span className={`status-dot-pulse ${record.status}`} />
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "32px" }}>
                      <span style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}>No records found.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="pagination-btn-premium"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="pagination-btn-premium"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StudentAttendanceView;