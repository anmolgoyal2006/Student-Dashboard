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

  if (loading && isTeacher) return <div className="spinner" />;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} color="var(--color-accent)" />
            Attendance tracker
          </h1>
          <p className="page-subtitle">Mark and monitor student and personal class attendance</p>
        </div>
      </div>

      {/* Contents based on role */}
      {isStudent && <StudentAttendanceView sid={user?.sid} />}

      {isTeacher && (
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