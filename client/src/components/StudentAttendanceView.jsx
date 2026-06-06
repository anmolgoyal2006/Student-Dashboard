import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "../context/ToastContext";
import { 
  Calendar, Check, X, Flame, BarChart2, BookOpen, Clock, 
  ChevronLeft, ChevronRight, User, Mail, ShieldAlert, Award
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
    pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  const badgeStyle = (status) =>
    status === "present"
      ? { background: "rgba(34,220,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,220,94,0.15)" }
      : { background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" };

  if (loading) return <div className="spinner" />;

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: "1rem" }}>
      <ShieldAlert size={40} color="#ef4444" />
      <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", textAlign: "center", maxWidth: "400px", lineHeight: "1.4" }}>{error}</p>
      {!sid && (
        <Link to="/profile" style={{
          marginTop: "0.5rem",
          padding: "0.6rem 1.2rem",
          background: "var(--color-accent)",
          color: "#fff",
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

  // SVG Donut metrics
  const radius = 60;
  const strokeWidth = 8;
  const r = radius - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (stats.percentage / 100) * circ;

  const statCards = [
    { label: "Total Classes", value: stats.total, icon: Clock, color: "var(--color-accent)" },
    { label: "Present", value: stats.present, icon: Check, color: "#22c55e" },
    { label: "Absent", value: stats.absent, icon: X, color: "#ef4444" },
    { label: "Attendance", value: `${stats.percentage}%`, icon: BarChart2, color: stats.percentage >= 75 ? "#22c55e" : stats.percentage >= 50 ? "#f59e0b" : "#ef4444" },
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
      `}</style>

      {/* Student info strip */}
      <div className="card mb-4" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#a78bfa)",
          color: "#fff", fontSize: "1.1rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {data.student.name?.charAt(0) || "S"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "14.5px", color: "var(--color-text-primary)" }}>
            {data.student.name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: 2 }}>
            {data.student.email}
          </div>
        </div>
        {data.student.sid && (
          <div style={{
            fontSize: "11px",
            color: "var(--color-accent)",
            fontWeight: 500,
            background: "var(--color-accent-muted)",
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
          }}>
            SID: {data.student.sid}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-4">
        {statCards.map((s) => {
          const IconComp = s.icon;
          return (
            <div className="card stat-card" key={s.label}>
              <span className="stat-icon" style={{ background: 'var(--color-accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconComp size={16} color="var(--color-accent)" />
              </span>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Mark attendance & Overall Ring */}
      <div className="grid-2 mb-4">
        
        {/* Mark Attendance Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={18} color="var(--color-accent)" />
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
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Subject */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Subject</label>
                    <select
                      className="form-select"
                      value={markForm.subjectId}
                      onChange={(e) => setMarkForm((p) => ({ ...p, subjectId: e.target.value }))}
                      required
                    >
                      <option value="">Select subject…</option>
                      {subjects.map((s) => (
                        <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Status Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {/* Date */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={markForm.date}
                        onChange={(e) => setMarkForm((p) => ({ ...p, date: e.target.value }))}
                      />
                    </div>

                    {/* Status radio buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Status</label>
                      <div style={{ display: 'flex', gap: 12, height: 38, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                          <input
                            type="radio"
                            name="mark-status"
                            value="present"
                            checked={markForm.status === 'present'}
                            onChange={() => setMarkForm(p => ({ ...p, status: 'present' }))}
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                          Present
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                          <input
                            type="radio"
                            name="mark-status"
                            value="absent"
                            checked={markForm.status === 'absent'}
                            onChange={() => setMarkForm(p => ({ ...p, status: 'absent' }))}
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                          Absent
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={marking}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      marginTop: 6
                    }}
                  >
                    {marking ? "Saving…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Overall SVG Donut Chart Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
          
          {/* Top Row: Title + Streak */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'absolute', top: 18, padding: '0 20px' }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={18} color="var(--color-accent)" />
              Overall attendance
            </div>
            {overallStreak >= 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24', fontSize: '13px', fontWeight: 500 }}>
                <Flame size={15} fill="#fbbf24" />
                <span>{overallStreak}-day streak</span>
              </div>
            )}
          </div>

          {stats.total > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24 }}>
              <div style={{ position: "relative", height: 120, width: 120, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    stroke="rgba(255, 255, 255, 0.05)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={r}
                    cx={radius}
                    cy={radius}
                  />
                  <circle
                    stroke="var(--color-accent)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circ} ${circ}`}
                    style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.35s' }}
                    strokeLinecap="round"
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
                  <span style={{ fontSize: "24px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {stats.percentage}%
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-tertiary)", fontWeight: 500 }}>
                    Attendance
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Present: <strong>{stats.present}</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Absent: <strong>{stats.absent}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: 24 }}>
              <BarChart2 size={32} color="var(--color-text-tertiary)" />
              <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", textAlign: "center" }}>No attendance records to visualize yet.</span>
            </div>
          )}
        </div>
      </div>

      {/* Two-column: breakdown + records */}
      <div className="grid-2">

        {/* Subject breakdown */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  return (
                    <div key={subject.code || subject.subject}>
                      <div className="attendance-sub-header">
                        <div className="attendance-sub-left">
                          <span className="attendance-sub-name" title={subject.subject}>
                            {subject.subject}
                          </span>
                          <span style={{
                            fontSize: "11px", color: "var(--color-text-secondary)",
                            background: "rgba(255,255,255,0.04)",
                            padding: "2px 6px", borderRadius: 4,
                          }}>
                            {subject.code}
                          </span>
                          {streak >= 2 && (
                            <span style={{
                              fontSize: "11px",
                              background: "rgba(245,158,11,0.1)",
                              color: "#f59e0b",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px"
                            }}>
                              <Flame size={10} fill="#f59e0b" /> {streak} Streak
                            </span>
                          )}
                        </div>
                        <div className="attendance-sub-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                            {subject.present}/{subject.total}
                          </span>
                          <span style={{
                            fontSize: "13.5px", fontWeight: 600, minWidth: 36,
                            textAlign: "right", color: barCol,
                          }}>
                            {subject.percentage}%
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: "100%", height: 6,
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "var(--radius-pill)", overflow: "hidden",
                        marginBottom: "4px"
                      }}>
                        <div style={{
                          height: "100%", borderRadius: "var(--radius-pill)",
                          width: `${subject.percentage}%`,
                          background: barCol,
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      <div style={{
                        fontSize: "11.5px",
                        color: insight.status === 'safe' ? "#22c55e" : insight.status === 'warning' ? "#f59e0b" : "#ef4444",
                        fontWeight: 500,
                        marginTop: "2px"
                      }}>
                        {insight.text}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Attendance records */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={18} color="var(--color-accent)" />
            Attendance records
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "6px", margin: "12px 0" }}>
            {["all", "present", "absent"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: filter === f ? "var(--color-accent)" : "transparent",
                  borderColor: filter === f ? "var(--color-accent)" : "var(--border)",
                  color: filter === f ? "#fff" : "var(--color-text-secondary)"
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Date", "Subject", "Code", "Status"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "8px 10px",
                      fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)",
                      textTransform: "uppercase", letterSpacing: "0.5px",
                      borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRecords.length > 0 ? (
                  pageRecords.map((record, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.01)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{
                        padding: "8px 10px",
                        color: "var(--color-text-secondary)", fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}>
                        {formatDate(record.date)}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--color-text-primary)", fontWeight: 500 }}>
                        {record.subject}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)", fontSize: "12.5px" }}>
                        {record.code}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: "var(--radius-pill)",
                          fontSize: "11px", fontWeight: 600,
                          ...badgeStyle(record.status),
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: record.status === 'present' ? "#22c55e" : "#ef4444",
                            display: "inline-block",
                          }} />
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "24px" }}>
                      <span style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}>No records found.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="btn btn-outline"
                style={{
                  padding: "4px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: 4, background: "transparent",
                  opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: "12.5px", color: "var(--color-text-secondary)" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="btn btn-outline"
                style={{
                  padding: "4px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: 4, background: "transparent",
                  opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
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