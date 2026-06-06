// ============================================================
// Attendance.jsx — Refactored for clarity, performance & UX
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import BulkAttendanceUpload from '../components/BulkAttendanceUpload';
import AttendanceRegisterScanner from '../components/AttendanceRegisterScanner';
import StudentAttendanceView from '../components/StudentAttendanceView';
import { attendanceService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { 
  Upload, Camera, Users, ClipboardList
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

// ============================================================
// Constants
// ============================================================

const TABS = {
  MY_ATTENDANCE: 'my-attendance',
  BULK_UPLOAD: 'bulk-upload'
};

const ATTENDANCE_THRESHOLDS = {
  CRITICAL: 60,
  WARNING: 75
};

// ============================================================
// Subcomponents
// ============================================================

/**
 * TabSwitcher — Renders role-aware tab navigation
 */
function TabSwitcher({ activeTab, onTabChange, isTeacher, isStudent }) {
  const handleTabClick = useCallback((tabId) => {
    if (isStudent && tabId === TABS.BULK_UPLOAD) {
      toast.error('Bulk upload is only available for teachers.');
      return;
    }
    if (isTeacher && tabId === TABS.MY_ATTENDANCE) {
      toast.error('My attendance view is only available for students.');
      return;
    }
    onTabChange(tabId);
  }, [isTeacher, isStudent]);

  if (isStudent) return null; // Students only see their view

  return (
    <div className="attendance-tabs">
      <TabButton
        tabId={TABS.MY_ATTENDANCE}
        icon={ClipboardList}
        label="My attendance"
        isActive={activeTab === TABS.MY_ATTENDANCE}
        isDisabled={isTeacher}
        onClick={handleTabClick}
      />
      <TabButton
        tabId={TABS.BULK_UPLOAD}
        icon={Upload}
        label="Bulk upload"
        isActive={activeTab === TABS.BULK_UPLOAD}
        isDisabled={isStudent}
        onClick={handleTabClick}
      />
      <style>{`
        .attendance-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
          gap: 24px;
        }
      `}</style>
    </div>
  );
}

/**
 * TabButton — Reusable tab button with consistent styling
 */
function TabButton({ tabId, icon: Icon, label, isActive, isDisabled, onClick }) {
  return (
    <button
      onClick={() => onClick(tabId)}
      disabled={isDisabled}
      role="tab"
      aria-selected={isActive}
      className={`tab-button ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
    >
      <Icon size={14} />
      <span>{label}</span>
      <style>{`
        .tab-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 4px;
          height: 40px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-text-primary);
          border-bottom: 2px solid transparent;
          font-size: 13.5px;
          font-weight: 400;
          transition: all 0.15s ease;
          opacity: 1;
        }
        .tab-button.active {
          color: var(--color-text-primary);
          border-bottom-color: var(--color-accent);
          font-weight: 500;
        }
        .tab-button.disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .tab-button:not(.disabled):hover {
          color: var(--color-accent);
        }
      `}</style>
    </button>
  );
}

/**
 * AttendanceCard — Generic card wrapper for consistent styling
 */
function AttendanceCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-header">
        {Icon && <Icon size={18} color="var(--color-accent)" />}
        <h2 className="card-title">{title}</h2>
      </div>
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
      {children}
      <style>{`
        .card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: ${subtitle ? 4 : 16}px;
        }
        .card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .card-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0 0 16px 0;
        }
      `}</style>
    </div>
  );
}

/**
 * StudentAttendanceTable — Displays student summary with sortable columns
 */
function StudentAttendanceTable({ data, isLoading }) {
  if (isLoading) {
    return <div className="spinner" />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        illustration="default"
        title="No student summary data yet"
        subtitle="Bulk upload student attendance files or scan registers to see summary statistics."
      />
    );
  }

  return (
    <div className="table-wrapper">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>SID</th>
            <th>Overall %</th>
            <th>Subjects</th>
          </tr>
        </thead>
        <tbody>
          {data.map((student, idx) => (
            <StudentTableRow key={student.sid || idx} student={student} />
          ))}
        </tbody>
      </table>
      <style>{`
        .table-wrapper {
          overflow-x: auto;
          border-radius: 6px;
          border: 1px solid var(--border);
        }
        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .attendance-table thead {
          background: var(--color-surface-3);
        }
        .attendance-table th {
          padding: 10px 12px;
          text-align: left;
          color: var(--color-text-secondary);
          font-weight: 500;
          border-bottom: 1px solid var(--border);
        }
        .attendance-table tbody tr {
          border-bottom: 1px solid var(--border);
          transition: background 0.15s ease;
        }
        .attendance-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}

/**
 * StudentTableRow — Individual student row with subject breakdown
 */
function StudentTableRow({ student }) {
  const getAttendanceColor = (percentage) => {
    if (percentage >= ATTENDANCE_THRESHOLDS.WARNING) return 'var(--color-success)';
    if (percentage >= ATTENDANCE_THRESHOLDS.CRITICAL) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getAttendanceBgColor = (percentage) => {
    if (percentage >= ATTENDANCE_THRESHOLDS.WARNING) return 'rgba(34,197,94,0.1)';
    if (percentage >= ATTENDANCE_THRESHOLDS.CRITICAL) return 'rgba(245,158,11,0.1)';
    return 'rgba(239,68,68,0.1)';
  };

  const getAttendanceBorderColor = (percentage) => {
    if (percentage >= ATTENDANCE_THRESHOLDS.WARNING) return 'rgba(34,197,94,0.2)';
    if (percentage >= ATTENDANCE_THRESHOLDS.CRITICAL) return 'rgba(245,158,11,0.2)';
    return 'rgba(239,68,68,0.2)';
  };

  return (
    <tr>
      <td>
        <div className="student-info">
          <div className="student-name">{student.name}</div>
          <div className="student-email">{student.email}</div>
        </div>
      </td>
      <td>{student.sid}</td>
      <td>
        <span
          className="attendance-badge"
          style={{ color: getAttendanceColor(student.overall) }}
        >
          {student.overall}%
        </span>
      </td>
      <td>
        <div className="subject-list">
          {student.subjects?.map((subject, idx) => (
            <SubjectBadge
              key={idx}
              subject={subject.subject}
              percentage={subject.percentage}
              bgColor={getAttendanceBgColor(subject.percentage)}
              borderColor={getAttendanceBorderColor(subject.percentage)}
              textColor={getAttendanceColor(subject.percentage)}
            />
          ))}
        </div>
      </td>
      <style>{`
        tr td {
          padding: 10px 12px;
          color: var(--color-text-primary);
        }
        .student-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .student-name {
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .student-email {
          font-size: 11px;
          color: var(--color-text-secondary);
        }
        .attendance-badge {
          font-weight: 600;
          font-size: 14px;
        }
        .subject-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
      `}</style>
    </tr>
  );
}

/**
 * SubjectBadge — Small badge showing subject attendance
 */
function SubjectBadge({ subject, percentage, bgColor, borderColor, textColor }) {
  return (
    <span
      className="subject-badge"
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        display: 'inline-block'
      }}
    >
      {subject}: {percentage}%
    </span>
  );
}

/**
 * TeacherDashboard — Teacher-specific view with upload and summary
 */
function TeacherDashboard({ classSummary, isLoading, onUploadSuccess, apiUrl }) {
  return (
    <div className="teacher-dashboard">
      <div className="card">
        <AttendanceCard
          icon={Upload}
          title="Bulk attendance upload"
          subtitle="Upload an Excel spreadsheet containing student IDs, codes, and attendance marks to update records in batch."
        >
          <BulkAttendanceUpload onUploadSuccess={onUploadSuccess} />

          <div className="divider">
            <AttendanceCard
              icon={Camera}
              title="Scan physical register"
              subtitle="Upload a photo of a physical attendance sheet. AI OCR will process and list student attendance records for review."
            >
              <AttendanceRegisterScanner uploadUrl={`${apiUrl}/attendance/upload`} />
            </AttendanceCard>
          </div>
        </AttendanceCard>
      </div>

      <div className="card">
        <AttendanceCard
          icon={Users}
          title="Student attendance summary"
        >
          <StudentAttendanceTable data={classSummary} isLoading={isLoading} />
        </AttendanceCard>
      </div>

      <style>{`
        .teacher-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .divider {
          margin-top: 24px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function Attendance() {
  const { user } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  useEffect(() => { setAuthReady(Boolean(user)); }, [user]);

  const [classSummary, setClassSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(
    isStudent ? TABS.MY_ATTENDANCE : TABS.BULK_UPLOAD
  );

 const loadTeacherData = useCallback(async () => {
    if (!authReady) return;
    if (!isTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await attendanceService.getClassSummary();
      setClassSummary(response.data.students || []);
    } catch (err) {
      if (err.response?.status === 403) {
        console.warn('[Attendance] Not authorized for class summary (expected if not teacher)');
        setLoading(false);
        return;
      }
      console.error('Failed to load class summary:', err);
      const msg = err.message || 'Failed to load class summary.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [isTeacher, authReady]);

  useEffect(() => {
    loadTeacherData();
  }, [loadTeacherData]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const shouldShowStudentView = isStudent && activeTab === TABS.MY_ATTENDANCE;
  const shouldShowTeacherView = isTeacher && activeTab === TABS.BULK_UPLOAD;

  return (
    <div className="attendance-container">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <ClipboardList size={20} color="var(--color-accent)" />
            Attendance tracker
          </h1>
          <p className="page-subtitle">
            Mark and monitor student and personal class attendance
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabSwitcher
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isTeacher={isTeacher}
        isStudent={isStudent}
      />

      {/* Error State */}
      {error && !loading && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={loadTeacherData} className="retry-button">
            Retry
          </button>
          <style>{`
            .error-banner {
              padding: 12px 16px;
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.3);
              border-radius: 6px;
              color: var(--color-danger);
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
            }
            .error-banner p {
              margin: 0;
              font-size: 13px;
            }
            .retry-button {
              padding: 4px 12px;
              font-size: 12px;
              background: var(--color-danger);
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              transition: opacity 0.15s;
            }
            .retry-button:hover {
              opacity: 0.9;
            }
          `}</style>
        </div>
      )}

      {/* Content */}
      {shouldShowStudentView && <StudentAttendanceView sid={user?.sid} />}
      {shouldShowTeacherView && (
        <TeacherDashboard
          classSummary={classSummary}
          isLoading={loading}
          onUploadSuccess={loadTeacherData}
          apiUrl={process.env.REACT_APP_API_URL}
        />
      )}

      {/* Global Styles */}
      <style>{`
        .attendance-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .page-header {
          margin-bottom: 12px;
          padding-bottom: 12px;
        }

        .page-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .page-subtitle {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .card {
          padding: 20px;
          background: var(--color-surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}