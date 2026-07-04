import { useEffect, useState } from 'react';
import UploadMarks from '../components/UploadMarks';
import { marksService, subjectService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { Bar } from 'react-chartjs-2';
import { 
  ChevronDown, ChevronRight, BarChart3, GraduationCap, ClipboardList, 
  BookOpen, Layers, Settings, FileText, Folder, Plus, Award, AlertCircle, RefreshCw
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import EmptyState from '../components/EmptyState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const EMPTY = { subjectId: '', examType: 'midterm', marksObtained: '', maxMarks: 100, examDate: '' };

const DEFAULT_SEM_CREDITS = [22, 21, 22, 24, 20, 12, 19, 21];

export default function Marks() {
  const [activeTab,    setActiveTab]    = useState('marks'); // Student sees Marks & CGPA by default

  const [marks,        setMarks]        = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [cgpaData,     setCgpaData]     = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [loading,      setLoading]      = useState(true);
  const [savedPdfs,    setSavedPdfs]    = useState([]);

  const [semesters,    setSemesters]    = useState([]);
  const [gradeOptions, setGradeOptions] = useState([]);
  const [semForm,      setSemForm]      = useState({
    semesterNumber: '',
    semesterName:   '',
    subjects:       [{ name: '', credits: '', grade: '' }],
  });
  const [semLoading,   setSemLoading]   = useState(false);
  const [cgpaSem,      setCgpaSem]      = useState(null);

  const [semMode,      setSemMode]      = useState('full'); // 'full' | 'manual'
  const [manualForm,   setManualForm]   = useState({ semesterNumber: '', semesterName: '', sgpa: '', semCredits: '' });
  const [manualLoading, setManualLoading] = useState(false);

  const load = async () => {
    try {
      const m      = await marksService.getAll();
      const s      = await subjectService.getAll();
      const c      = await marksService.getCGPA();
      const sems   = await marksService.getSemesters();
      const grades = await marksService.getGradeOptions();
      const cgpas  = await marksService.getCGPAbySemester();
      const pdfs   = await marksService.getSavedPdfs();

      setMarks(m.data.marks || []);
      setSubjects(s.data.subjects || []);
      setCgpaData(c.data);
      setSemesters(sems.data.semesters || []);
      setGradeOptions(grades.data.gradeOptions || []);
      setCgpaSem(cgpas.data);
      setSavedPdfs(pdfs.data.pdfs || []);
      setLoading(false);
    } catch (err) {
      console.error('FAILED API:', err.config?.url, err);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await marksService.add(form);
      toast.success('Marks added!');
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async id => {
    await marksService.remove(id);
    toast.success('Deleted');
    load();
  };

  const updateSubjectRow = (i, field, value) =>
    setSemForm(p => ({
      ...p,
      subjects: p.subjects.map((s, idx) => idx === i ? { ...s, [field]: value } : s),
    }));

  const addSubjectRow = () =>
    setSemForm(p => ({
      ...p,
      subjects: [...p.subjects, { name: '', credits: '', grade: gradeOptions[0]?.grade || '' }],
    }));

  const removeSubjectRow = i =>
    setSemForm(p => ({ ...p, subjects: p.subjects.filter((_, idx) => idx !== i) }));

  const handleAddSemester = async () => {
    try {
      setSemLoading(true);
      await marksService.addSemester({
        semesterNumber: Number(semForm.semesterNumber),
        semesterName:   semForm.semesterName,
        subjects: semForm.subjects.map(s => ({
          name:    s.name,
          credits: Number(s.credits),
          grade:   s.grade,
        })),
      });
      toast.success('Semester added!');
      setSemForm({
        semesterNumber: '',
        semesterName:   '',
        subjects: [{ name: '', credits: '', grade: gradeOptions[0]?.grade || '' }],
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSemLoading(false);
    }
  };

  const handleAddManualSGPA = async () => {
    const { semesterNumber, semesterName, sgpa } = manualForm;
    if (!semesterNumber || !sgpa) return toast.error('Semester No. and SGPA are required');
    if (Number(sgpa) < 0 || Number(sgpa) > 10) return toast.error('SGPA must be between 0 and 10');
    try {
      setManualLoading(true);
      await marksService.addManualSGPA({ semesterNumber, semesterName, sgpa: Number(sgpa), semCredits: manualForm.semCredits ? Number(manualForm.semCredits) : undefined });
      toast.success('Past SGPA added!');
      setManualForm({ semesterNumber: '', semesterName: '', sgpa: '', semCredits: '', _creditsManuallyEdited: false });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setManualLoading(false);
    }
  };

  const handleDeleteSemester = async id => {
    await marksService.deleteSemester(id);
    toast.success('Semester deleted');
    load();
  };

  const handleDownloadSavedPdf = async (id, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/marks/saved-pdfs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download PDF.');
    }
  };

  const handleDeleteSavedPdf = async (id) => {
    if (!window.confirm('Are you sure you want to delete this saved PDF?')) return;
    try {
      await marksService.deleteSavedPdf(id);
      toast.success('Saved PDF deleted.');
      const res = await marksService.getSavedPdfs();
      setSavedPdfs(res.data.pdfs || []);
    } catch (err) {
      toast.error('Failed to delete saved PDF.');
    }
  };

  const chartData = {
    labels: (cgpaData?.breakdown || []).map(b => b.subject),
    datasets: [{
      label: 'Grade Point',
      data:  (cgpaData?.breakdown || []).map(b => b.gradePoint),
      backgroundColor: 'rgba(99, 102, 241, 0.7)',
      borderRadius: 6,
    }],
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <style>{`
        .marks-subject-row {
          display: grid;
          grid-template-columns: 2fr 80px 100px auto;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }
        @media (max-width: 500px) {
          .marks-subject-row {
            grid-template-columns: 1fr 80px auto;
            gap: 6px;
          }
          .marks-subject-name {
            grid-column: span 3;
          }
        }
      `}</style>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} color="var(--color-accent)" />
            Marks & CGPA
          </h1>
          <p className="page-subtitle">Track your exam performance and calculate CGPA</p>
        </div>
        {cgpaData?.cgpa > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 500, color: 'var(--color-accent)' }}>{cgpaData.cgpa}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>Current CGPA</div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Semester 4
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          6 subjects
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-accent)',
          background: 'var(--color-accent-muted)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          SGPA 9.13
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        {[
          { id: 'marks', label: 'Marks & CGPA', icon: ClipboardList },
          { id: 'semester', label: 'Semesters', icon: Layers },
          { id: 'upload', label: 'Upload PDF & Rank', icon: FileText },
          { id: 'saved-pdfs', label: 'Saved PDFs Library', icon: Folder }
        ].map(t => {
          const active = activeTab === t.id;
          const IconComponent = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 4px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <IconComponent size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content renderer */}
      {activeTab === 'marks' && (
        <>
          <div className="grid-2 mb-4">
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={18} color="var(--color-accent)" />
                Add exam marks
              </div>
              <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={form.subjectId}
                    onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))} required>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Exam Type</label>
                  <select className="form-select" value={form.examType}
                    onChange={e => setForm(p => ({ ...p, examType: e.target.value }))}>
                    {['midterm', 'final', 'quiz', 'assignment', 'practical'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Marks Obtained</label>
                    <input className="form-input" type="number" min="0"
                       value={form.marksObtained}
                       onChange={e => setForm(p => ({ ...p, marksObtained: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Marks</label>
                    <input className="form-input" type="number" min="1"
                       value={form.maxMarks}
                       onChange={e => setForm(p => ({ ...p, maxMarks: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Exam Date</label>
                  <input className="form-input" type="date" value={form.examDate}
                    onChange={e => setForm(p => ({ ...p, examDate: e.target.value }))} />
                </div>
                <button className="btn btn-primary" type="submit">Add Marks</button>
              </form>
            </div>

            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={18} color="var(--color-accent)" />
                Grade points (Final exams)
              </div>
              <div style={{ marginTop: 12 }}>
                {cgpaData?.breakdown?.length > 0
                  ? <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } }} />
                  : <p className="text-muted">Add final exam marks to see CGPA breakdown.</p>
                }
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={18} color="var(--color-accent)" />
              All marks
            </div>
            <div style={{ marginTop: 12 }}>
              {marks.length === 0 ? (
                <EmptyState
                  illustration="marks"
                  title="No marks records yet"
                  subtitle="Start logging your exams and midterms above to track performance."
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Subject</th><th>Type</th><th>Marks</th><th>Grade Pt.</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {marks.map(m => (
                        <tr key={m._id}>
                          <td>{m.subjectId?.name || '—'}</td>
                          <td><span className="badge badge-primary">{m.examType}</span></td>
                          <td>{m.marksObtained} / {m.maxMarks} ({((m.marksObtained / m.maxMarks) * 100).toFixed(1)}%)</td>
                          <td><strong>{m.gradePoint}</strong></td>
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m._id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'upload' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px 24px' }}>
            <UploadMarks onResult={() => {}} />
          </div>
        </div>
      )}

      {activeTab === 'semester' && (
        <>
          {cgpaSem?.totalSemesters > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '14px 20px', borderRadius: 14, marginBottom: 20,
              background: 'var(--color-accent-muted)', border: '1px solid rgba(99,102,241,0.2)',
              flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Semester CGPA</p>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 500, color: 'var(--color-accent)' }}>{cgpaSem.cgpa}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {cgpaSem.totalSemesters} semester{cgpaSem.totalSemesters > 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>SGPA per Semester</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cgpaSem.sgpaList.map((s, i) => (
                    <span key={`sgpa-${i}`} style={{
                      fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                      background: 'var(--color-surface-2)', border: '1px solid var(--border)',
                      color: 'var(--color-text-primary)',
                    }}>
                      S{i + 1}: {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setSemMode('full')}
              style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(129,140,248,0.4)',
                background: semMode === 'full' ? 'var(--color-accent-muted)' : 'transparent',
                color: semMode === 'full' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <BookOpen size={14} />
              Add with subjects
            </button>
            <button
              onClick={() => setSemMode('manual')}
              style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(129,140,248,0.4)',
                background: semMode === 'manual' ? 'var(--color-accent-muted)' : 'transparent',
                color: semMode === 'manual' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Layers size={14} />
              Import SGPA directly
            </button>
          </div>

          <div className="grid-2">
            {semMode === 'full' ? (
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={18} color="var(--color-accent)" />
                  Add semester
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Semester No. *</label>
                    <input className="form-input" type="number" min="1" placeholder="e.g. 1"
                       value={semForm.semesterNumber}
                       onChange={e => setSemForm(p => ({ ...p, semesterNumber: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label (optional)</label>
                    <input className="form-input" type="text" placeholder="e.g. Fall 2024"
                       value={semForm.semesterName}
                       onChange={e => setSemForm(p => ({ ...p, semesterName: e.target.value }))} />
                  </div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Subjects *</label>
                  {semForm.subjects.map((s, i) => (
                    <div key={`semform-subj-${i}`} className="marks-subject-row">
                      <input className="form-input marks-subject-name" placeholder="Subject name"
                        value={s.name} onChange={e => updateSubjectRow(i, 'name', e.target.value)} />
                      <input className="form-input" style={{ width: 80 }} type="number" min="1" placeholder="Credits"
                        value={s.credits} onChange={e => updateSubjectRow(i, 'credits', e.target.value)} />
                      <select className="form-select" style={{ width: 100 }} value={s.grade}
                        onChange={e => updateSubjectRow(i, 'grade', e.target.value)}>
                        {gradeOptions.map(({ grade, point }) => (
                          <option key={grade} value={grade}>{grade} ({point})</option>
                        ))}
                      </select>
                      {semForm.subjects.length > 1 ? (
                        <button className="btn btn-danger btn-sm" onClick={() => removeSubjectRow(i)}>✕</button>
                      ) : (
                        <div style={{ width: 28 }} />
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button className="btn btn-outline" style={{ background: 'transparent' }} onClick={addSubjectRow}>+ Subject</button>
                    <button className="btn btn-primary" onClick={handleAddSemester} disabled={semLoading}>
                      {semLoading ? 'Saving…' : 'Save Semester'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={18} color="var(--color-accent)" />
                  Import past SGPA
                </div>
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    Already in 3rd or 4th sem? Enter your past semester SGPAs directly without re-entering all subjects.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Semester No. *</label>
                    <input className="form-input" type="number" min="1" placeholder="e.g. 1"
                       value={manualForm.semesterNumber}
                       onChange={e => {
                         const val = e.target.value;
                         const idx = parseInt(val, 10) - 1;
                         const defaultCredit = idx >= 0 && idx < DEFAULT_SEM_CREDITS.length
                           ? String(DEFAULT_SEM_CREDITS[idx])
                           : '';
                         setManualForm(p => ({
                           ...p,
                           semesterNumber: val,
                           // Only auto-fill if user hasn't manually changed credits yet
                           semCredits: p._creditsManuallyEdited ? p.semCredits : defaultCredit,
                         }));
                       }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label (optional)</label>
                    <input className="form-input" type="text" placeholder="e.g. First sem"
                       value={manualForm.semesterName}
                       onChange={e => setManualForm(p => ({ ...p, semesterName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SGPA *</label>
                    <input className="form-input" type="number" min="0" max="10" step="0.01" placeholder="e.g. 8.75"
                       value={manualForm.sgpa}
                       onChange={e => setManualForm(p => ({ ...p, sgpa: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Credits (for accurate CGPA)</label>
                    <input className="form-input" type="number" min="1" step="1" placeholder="e.g. 24"
                       value={manualForm.semCredits}
                       onChange={e => setManualForm(p => ({ ...p, semCredits: e.target.value, _creditsManuallyEdited: true }))} />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddManualSGPA} disabled={manualLoading}>
                    {manualLoading ? 'Saving…' : 'Add Past SGPA'}
                  </button>
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> Add all your past semesters one by one to get an accurate CGPA.
                  </p>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={18} color="var(--color-accent)" />
                Semesters
              </div>
              <div style={{ marginTop: 12 }}>
                {semesters.length === 0 ? (
                  <EmptyState
                    illustration="marks"
                    title="No semesters logged yet"
                    subtitle="Track semester progress by adding subjects or importing past SGPA scores."
                  />
                ) : (
                  semesters.map(sem => (
                    <div key={sem._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>
                            Semester {sem.semesterNumber}{sem.semesterName ? ` — ${sem.semesterName}` : ''}
                          </span>
                          <span style={{
                            marginLeft: 10, fontSize: 11, fontWeight: 500, color: 'var(--color-accent)',
                            background: 'var(--color-accent-muted)', border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: 99, padding: '2px 8px',
                          }}>
                            SGPA {sem.sgpa}
                          </span>
                          {sem.isManual && (
                            <span style={{
                              marginLeft: 6, fontSize: 10, fontWeight: 500, color: 'var(--color-warning)',
                              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                              borderRadius: 99, padding: '2px 7px',
                            }}>
                              manual
                            </span>
                          )}
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSemester(sem._id)}>Delete</button>
                      </div>
                      {sem.isManual && sem.totalCredits ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          {sem.totalCredits} credits
                        </div>
                      ) : !sem.isManual ? (
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {sem.subjects.map((s, i) => (
                            <span key={`${sem._id}-subj-${i}`} style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 99,
                              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                              color: 'var(--color-text-secondary)',
                            }}>
                              {s.name} · {s.grade} · {s.credits}cr
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'saved-pdfs' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Folder size={18} color="var(--color-accent)" />
                Saved PDFs Library
              </h3>
              <p className="text-muted" style={{ fontSize: 12.5, fontWeight: 'normal', marginTop: 4 }}>
                Access and download your saved exam or scorecard PDFs at any time
              </p>
            </div>
            <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 28, minHeight: 'auto', padding: '0 12px', background: 'transparent' }} onClick={async () => {
              const res = await marksService.getSavedPdfs();
              setSavedPdfs(res.data.pdfs || []);
              toast.success('Refreshed library');
            }}>
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          {savedPdfs.length === 0 ? (
            <EmptyState
              illustration="marks"
              title="Your saved PDF library is empty"
              subtitle="You can save scorecards or exam PDFs while uploading them in the Upload PDF & Rank Students tab."
            />
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Document Name</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Original Filename</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Uploaded Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedPdfs.map((pdf) => (
                    <tr key={pdf._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <strong>{pdf.name}</strong>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontSize: 12.5 }}>
                        {pdf.fileName}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontSize: 12.5 }}>
                        {new Date(pdf.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginRight: 8, padding: '5px 12px' }}
                          onClick={() => handleDownloadSavedPdf(pdf._id, pdf.fileName)}
                        >
                          Download
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '5px 12px' }}
                          onClick={() => handleDeleteSavedPdf(pdf._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}