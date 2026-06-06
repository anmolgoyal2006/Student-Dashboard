// ============================================================
// Attendance.jsx — uses design tokens and custom toast/tabs
// ============================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BulkAttendanceUpload from '../components/BulkAttendanceUpload';
import AttendanceRegisterScanner from '../components/AttendanceRegisterScanner';
import StudentAttendanceView from '../components/StudentAttendanceView';
import { attendanceService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { 
  Upload, Camera, Users, ClipboardList, CheckCircle, 
  AlertTriangle, AlertCircle, BookOpen, Layout, Settings
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function Attendance() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const [classSummary, setClassSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isStudent ? 'my-attendance' : 'bulk-upload');

  const loadTeacherData = async () => {
    if (!isTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const cs = await attendanceService.getClassSummary();
      setClassSummary(cs.data.students || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load class summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherData();
  }, [user]);

  const handleTabClick = (tabId) => {
    if (isStudent && tabId === 'bulk-upload') {
      toast.error('Bulk upload is only available for teachers.');
      return;
    }
    if (isTeacher && tabId === 'my-attendance') {
      toast.error('My attendance view is only available for students.');
      return;
    }
    setActiveTab(tabId);
  };

  if (loading && isTeacher) return <div className="spinner" />;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .main-content {
          padding-top: 32px !important;
          padding-left: 24px !important;
          padding-right: 24px !important;
        }
      `}</style>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 12, paddingBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--color-accent)" />
            Attendance tracker
          </h1>
          <p className="page-subtitle">Mark and monitor student and personal class attendance</p>
        </div>
      </div>

      {/* Tabs switcher - visible to teachers only (students have bulk upload removed) */}
      {!isStudent && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
          gap: 24,
          marginTop: 0
        }}>
          <button
            onClick={() => handleTabClick('my-attendance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 4px',
              height: 40,
              background: 'transparent',
              border: 'none',
              cursor: isTeacher ? 'not-allowed' : 'pointer',
              color: activeTab === 'my-attendance' ? '#fff' : 'var(--color-text-secondary)',
              borderBottom: activeTab === 'my-attendance' ? '2px solid var(--color-accent)' : '2px solid transparent',
              fontSize: 13.5,
              fontWeight: activeTab === 'my-attendance' ? 500 : 400,
              transition: 'all 0.15s ease',
              opacity: isTeacher ? 0.45 : 1
            }}
          >
            <ClipboardList size={14} style={{ display: 'flex', alignItems: 'center' }} />
            <span>My attendance</span>
          </button>

          <button
            onClick={() => handleTabClick('bulk-upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 4px',
              height: 40,
              background: 'transparent',
              border: 'none',
              cursor: isStudent ? 'not-allowed' : 'pointer',
              color: activeTab === 'bulk-upload' ? '#fff' : 'var(--color-text-secondary)',
              borderBottom: activeTab === 'bulk-upload' ? '2px solid var(--color-accent)' : '2px solid transparent',
              fontSize: 13.5,
              fontWeight: activeTab === 'bulk-upload' ? 500 : 400,
              transition: 'all 0.15s ease',
              opacity: isStudent ? 0.45 : 1
            }}
          >
            <Upload size={14} style={{ display: 'flex', alignItems: 'center' }} />
            <span>Bulk upload</span>
          </button>
        </div>
      )}

      {/* Contents based on active tab & role */}
      {activeTab === 'my-attendance' && isStudent && (
        <StudentAttendanceView sid={user?.sid} />
      )}

      {activeTab === 'bulk-upload' && isTeacher && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Upload size={18} color="var(--color-accent)" />
              Bulk attendance upload
            </div>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Upload an Excel spreadsheet containing student IDs, codes, and attendance marks to update records in batch.
            </p>
            <BulkAttendanceUpload onUploadSuccess={loadTeacherData} />

            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Camera size={18} color="var(--color-accent)" />
                Scan physical register
              </div>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Upload a photo of a physical attendance sheet. AI OCR will process and list student attendance records for review.
              </p>
              <AttendanceRegisterScanner uploadUrl={`${process.env.REACT_APP_API_URL}/attendance/upload`} />
            </div>
          </div>

          {/* Student summary — visible to teachers */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Users size={18} color="var(--color-accent)" />
              Student attendance summary
            </div>
            {classSummary.length === 0 ? (
              <EmptyState
                illustration="default"
                title="No student summary data yet"
                subtitle="Bulk upload student attendance files or scan registers to see summary statistics."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-3)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Student</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>SID</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Overall %</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classSummary.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{s.sid}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontWeight: 600,
                            color: s.overall >= 75 ? '#22c55e' : s.overall >= 60 ? '#f59e0b' : '#ef4444'
                          }}>
                            {s.overall}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {s.subjects.map((sub, j) => (
                              <span key={j} style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                                background: sub.percentage >= 75 ? 'rgba(34,197,94,0.1)' : sub.percentage >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                color: sub.percentage >= 75 ? '#22c55e' : sub.percentage >= 60 ? '#f59e0b' : '#ef4444',
                                border: `1px solid ${sub.percentage >= 75 ? 'rgba(34,197,94,0.2)' : sub.percentage >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                              }}>
                                {sub.subject}: {sub.percentage}%
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}