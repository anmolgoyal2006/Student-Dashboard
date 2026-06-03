import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);




const StudentAttendanceView = ({ sid }) => {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState("all");
  const [subjects, setSubjects] = useState([]);
  const [markForm, setMarkForm] = useState({
    subjectId: "",
    date:      new Date().toISOString().slice(0, 10),
    status:    "present",
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
    } finally {
      setMarking(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  const getOverallStats = () => {
    if (!data) return {};
    const present    = data.records.filter((r) => r.status === "present").length;
    const absent     = data.records.filter((r) => r.status === "absent").length;
    const total      = present + absent;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
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

  const getSmartInsight = (present, total) => {
    if (total === 0) return { status: 'no_data', text: 'No attendance records yet.' };
    const percentage = (present / total) * 100;
    if (percentage >= 75) {
      const maxMiss = Math.floor(present / 0.75 - total);
      if (maxMiss > 0) {
        return {
          status: 'safe',
          text: `✅ Safe. You can miss up to ${maxMiss} class${maxMiss > 1 ? 'es' : ''} without dropping below 75%.`
        };
      } else {
        return {
          status: 'warning',
          text: `⚡ Safe, but tight. You cannot miss any upcoming classes without dropping below 75%.`
        };
      }
    } else {
      const needed = Math.ceil((0.75 * total - present) / 0.25);
      return {
        status: 'danger',
        text: `⚠️ Critical. Attend the next ${needed} consecutive class${needed > 1 ? 'es' : ''} to reach 75%.`
      };
    }
  };

  const filteredRecords = data?.records.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const barColor = (pct) =>
    pct >= 75 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171";

  const barBg = (pct) =>
    pct >= 75
      ? "linear-gradient(90deg,#16a34a,#4ade80)"
      : pct >= 50
      ? "linear-gradient(90deg,#d97706,#fbbf24)"
      : "linear-gradient(90deg,#dc2626,#f87171)";

  const badgeStyle = (status) =>
    status === "present"
      ? { background: "rgba(74,222,128,0.1)", color: "#4ade80" }
      : { background: "rgba(248,113,113,0.1)", color: "#f87171" };

  const dotColor = (status) =>
    status === "present" ? "#4ade80" : "#f87171";

  if (loading) return <div className="spinner" />;

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: "1rem" }}>
      <span style={{ fontSize: "2rem", color: "#f87171" }}>⚠</span>
      <p style={{ color: "#f87171", fontSize: "0.95rem", textAlign: "center", maxWidth: "400px", lineHeight: "1.4" }}>{error}</p>
      {!sid && (
        <Link to="/profile" style={{
          marginTop: "0.5rem",
          padding: "0.6rem 1.2rem",
          background: "var(--primary)",
          color: "#fff",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: 600,
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

  const doughnutData = {
    labels: ["Present", "Absent"],
    datasets: [
      {
        data: [stats.present || 0, stats.absent || 0],
        backgroundColor: ["#10b981", "#ef4444"],
        borderWidth: 0,
        hoverBackgroundColor: ["#34d399", "#f87171"],
        cutout: "75%",
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  const statCards = [
    { label: "Total Classes", value: stats.total,      icon: "📅", color: "#3b82f6" },
    { label: "Present",       value: stats.present,    icon: "✅", color: "#34d399" },
    { label: "Absent",        value: stats.absent,     icon: "❌", color: "#f87171" },
    { label: "Attendance",    value: `${stats.percentage}%`, icon: "📊", color: "#818cf8" },
  ];

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Attendance</h1>
          <p className="page-subtitle">Track and manage your class attendance</p>
        </div>
      </div>

      {/* ── Student info strip ── */}
      <div className="card mb-4" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#a78bfa)",
          color: "#fff", fontSize: "1.1rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {data.student.name?.charAt(0) || "S"}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
            {data.student.name}
          </div>
          <div className="text-muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
            {data.student.email}
          </div>
          {data.student.sid && (
            <div style={{ fontSize: "0.72rem", color: "var(--primary)", marginTop: 2, fontWeight: 600 }}>
              SID: {data.student.sid}
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid-4 mb-4">
        {statCards.map((s) => (
          <div className="card stat-card" key={s.label}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Mark attendance & Overall Doughnut ── */}
      <div className="grid-2 mb-4">
        {/* Mark Attendance */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="card-title">✏️ Mark Today's Attendance</div>
            <form onSubmit={handleMark}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {/* Subject */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{
                    fontSize: "0.68rem", color: "var(--muted)",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>Subject</label>
                  <select
                    style={{
                      background: "#161b22",
                      border: "1px solid var(--border)",
                      borderRadius: 8, padding: "0.52rem 0.75rem",
                      color: "var(--text)", fontSize: "0.85rem", width: "100%", outline: "none",
                      colorScheme: "dark",
                    }}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  {/* Date */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <label style={{
                      fontSize: "0.68rem", color: "var(--muted)",
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                    }}>Date</label>
                    <input
                      type="date"
                      style={{
                        background: "#161b22",
                        border: "1px solid var(--border)",
                        borderRadius: 8, padding: "0.52rem 0.75rem",
                        color: "var(--text)", fontSize: "0.85rem", width: "100%", outline: "none",
                        colorScheme: "dark",
                      }}
                      value={markForm.date}
                      onChange={(e) => setMarkForm((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>

                  {/* Status */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <label style={{
                      fontSize: "0.68rem", color: "var(--muted)",
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                    }}>Status</label>
                    <select
                      style={{
                        background: "#161b22",
                        border: "1px solid var(--border)",
                        borderRadius: 8, padding: "0.52rem 0.75rem",
                        color: "var(--text)", fontSize: "0.85rem", width: "100%", outline: "none",
                        colorScheme: "dark",
                      }}
                      value={markForm.status}
                      onChange={(e) => setMarkForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={marking}
                  style={{
                    background: "var(--primary)", color: "#fff", border: "none",
                    borderRadius: 8, padding: "0.52rem 1.4rem",
                    fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                    height: 38, opacity: marking ? 0.5 : 1,
                    transition: "opacity 0.15s",
                    marginTop: "0.4rem",
                  }}
                >
                  {marking ? "Saving…" : "Mark Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Overall Doughnut Chart */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div className="card-title" style={{ width: "100%", alignSelf: "flex-start", marginBottom: "1rem" }}>📊 Overall Attendance</div>
          {stats.total > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <div style={{ position: "relative", height: 150, width: 150, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div style={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
                    {stats.percentage}%
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Attendance
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "1.2rem", marginTop: "1.2rem", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Present: <strong>{stats.present}</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Absent: <strong>{stats.absent}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "2rem 0" }}>
              <span style={{ fontSize: "2rem" }}>📈</span>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center" }}>No attendance records to visualize yet.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column: breakdown + records ── */}
      <div className="grid-2">

        {/* Subject breakdown */}
        <div className="card">
          <div className="card-title">📚 Subject-wise Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.25rem" }}>
            {data.summary
              .filter((s) => s.subject && s.subject !== "Unknown")
              .map((subject) => {
                const streak = getSubjectStreak(subject.code);
                const insight = getSmartInsight(subject.present, subject.total);
                return (
                  <div key={subject.code || subject.subject} style={{ marginBottom: "0.5rem" }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: "0.4rem",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
                          {subject.subject}
                        </span>
                        <span style={{
                          fontSize: "0.68rem", color: "var(--muted)",
                          background: "rgba(255,255,255,0.06)",
                          padding: "2px 7px", borderRadius: 5,
                        }}>
                          {subject.code}
                        </span>
                        {streak >= 2 && (
                          <span style={{
                            fontSize: "0.68rem",
                            background: "rgba(249,115,22,0.15)",
                            color: "#ff7a00",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px"
                          }}>
                            🔥 {streak} Streak
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="text-muted" style={{ fontSize: "0.73rem" }}>
                          {subject.present}/{subject.total}
                        </span>
                        <span style={{
                          fontSize: "0.82rem", fontWeight: 700, minWidth: 36,
                          textAlign: "right", color: barColor(subject.percentage),
                        }}>
                          {subject.percentage}%
                        </span>
                      </div>
                    </div>
                    <div style={{
                      width: "100%", height: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 99, overflow: "hidden",
                      marginBottom: "0.3rem"
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        width: `${subject.percentage}%`,
                        background: barBg(subject.percentage),
                        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                    <div style={{
                      fontSize: "0.72rem",
                      color: insight.status === 'safe' ? "#10b981" : insight.status === 'warning' ? "#f59e0b" : "#ef4444",
                      fontWeight: 500,
                      marginTop: "2px"
                    }}>
                      {insight.text}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Attendance records */}
        <div className="card">
          <div className="card-title">📋 Attendance Records</div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "0.5rem", margin: "0.75rem 0 1rem" }}>
            {["all", "present", "absent"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "0.28rem 0.85rem", borderRadius: 99,
                  border: `1px solid ${filter === f ? "var(--primary)" : "var(--border)"}`,
                  background: filter === f ? "var(--primary)" : "transparent",
                  color: filter === f ? "#fff" : "var(--muted)",
                  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Date", "Subject", "Code", "Status"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "0.55rem 0.75rem",
                      fontSize: "0.66rem", fontWeight: 700, color: "var(--muted)",
                      textTransform: "uppercase", letterSpacing: "0.4px",
                      borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords?.length > 0 ? (
                  filteredRecords.map((record, idx) => (
                    <tr key={idx} style={{ transition: "background 0.1s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted)", fontSize: "0.8rem", fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}>
                        {formatDate(record.date)}
                      </td>
                      <td style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text)",
                      }}>
                        {record.subject}
                      </td>
                      <td style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted)", fontSize: "0.8rem",
                      }}>
                        {record.code}
                      </td>
                      <td style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid var(--border)",
                      }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "0.18rem 0.65rem", borderRadius: 99,
                          fontSize: "0.72rem", fontWeight: 700,
                          ...badgeStyle(record.status),
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: dotColor(record.status),
                            display: "inline-block",
                          }} />
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{
                      textAlign: "center", padding: "2rem",
                      color: "var(--muted)", fontSize: "0.875rem",
                    }}>
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentAttendanceView;