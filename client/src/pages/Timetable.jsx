import { useEffect, useState, useMemo, useRef } from 'react';
import { subjectService } from '../services/apiServices';
import toast from '../context/ToastContext';
import WeeklyGrid, { exportTimetablePDF } from '../components/WeeklyGrid';
import EmptyState from '../components/EmptyState';
import Skeleton, { CardSkeleton, StatsSkeleton } from '../components/Skeleton';
import TimetableImportPreview from '../components/TimetableImportPreview';
import { LayoutGrid, List, Plus, Edit, Trash2, Calendar, Clock, BookOpen, X, ChevronRight, Upload, FileText, Loader2, Download } from 'lucide-react';

const DAYS      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMPTY     = { name: '', code: '', instructor: '', credits: 4, schedule: [] };
const EMPTY_SLOT = { day: 'Mon', startTime: '09:00', endTime: '10:00', room: '' };

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const toMinutes = (t) => {
  if (!t) return 0;
  const str = String(t).trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = str.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

/* ── palette — pure black canvas, vibrant accents ─────────────────────────── */
const C = {
  bg:        '#000000',
  surface:   '#0a0a0a',
  surface2:  '#111111',
  border:    'rgba(255,255,255,0.08)',
  border2:   'rgba(255,255,255,0.14)',
  accent:    '#6366f1',
  accentMid: 'rgba(99,102,241,0.18)',
  accentLow: 'rgba(99,102,241,0.08)',
  success:   '#22c55e',
  warning:   '#f59e0b',
  danger:    '#ef4444',
  text:      '#f8fafc',
  textSub:   '#94a3b8',
  textMuted: '#64748b',
};

const card = (extra = {}) => ({
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: '22px 24px',
  ...extra,
});

/* ── subject colour wheel ──────────────────────────────────────────────────── */
const SUBJECT_COLORS = [
  { bg: 'rgba(99,102,241,0.14)',  border: 'rgba(99,102,241,0.35)',  dot: '#818cf8' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)',  dot: '#34d399' },
  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)',  dot: '#fbbf24' },
  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',   dot: '#f87171' },
  { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.28)', dot: '#2dd4bf' },
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.28)', dot: '#c084fc' },
];
const subjectColor = (idx) => SUBJECT_COLORS[idx % SUBJECT_COLORS.length];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Timetable() {
  const [subjects, setSubjects] = useState([]);
  const [form,     setForm]     = useState(EMPTY);
  const [editing,  setEditing]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab,      setTab]      = useState('grid');

  /* ── PDF import ───────────────────────────────────────────────────────── */
  const fileInputRef = useRef(null);
  const [parsing,   setParsing]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview,   setPreview]   = useState(null);   // { entries, fileName }

  const load = async () => {
    try {
      const { data } = await subjectService.getAll();
      setSubjects(data.subjects);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── time helpers ─────────────────────────────────────────────────────── */
  const todayName = DAYS[new Date().getDay()];
  const nowMin    = new Date().getHours() * 60 + new Date().getMinutes();

  const todayClasses = useMemo(() => {
    const classes = [];
    subjects.forEach((s, si) =>
      (s.schedule || [])
        .filter(sl => sl.day === todayName)
        .forEach(sl => classes.push({ ...sl, name: s.name, code: s.code, subjectId: s._id, colorIdx: si }))
    );
    return classes.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  }, [subjects, todayName]);

  const nextClass    = useMemo(() => todayClasses.find(c => toMinutes(c.startTime) > nowMin) || null, [todayClasses, nowMin]);
  const currentClass = useMemo(() => todayClasses.find(c => toMinutes(c.startTime) <= nowMin && toMinutes(c.endTime) > nowMin) || null, [todayClasses, nowMin]);

  /* ── form ─────────────────────────────────────────────────────────────── */
  const handleChange     = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleSlotChange = (i, field, val) => setForm(p => {
    const slots = [...(p.schedule || [])];
    slots[i] = { ...slots[i], [field]: val };
    return { ...p, schedule: slots };
  });
  const addSlot    = () => setForm(p => ({ ...p, schedule: [...(p.schedule || []), { ...EMPTY_SLOT }] }));
  const removeSlot = i   => setForm(p => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (editing) { await subjectService.update(editing, form); toast.success('Subject updated'); }
      else         { await subjectService.add(form);             toast.success('Subject added');   }
      setForm(EMPTY); setEditing(null); setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePdfSelected = async e => {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await subjectService.importPdf(fd);
      setPreview({ entries: data.entries, fileName: file.name });
      if (data.conflicts > 0) toast.warning(`${data.conflicts} schedule conflict(s) detected — check highlighted entries.`);
      else if (data.flagged) toast.warning(`${data.flagged} subject(s) need review.`);
    } catch (err) {
      const res = err.response?.data;
      toast.error([res?.message, res?.hint].filter(Boolean).join(' ') || 'Could not read that PDF.');
    } finally { setParsing(false); }
  };

  const handleConfirmImport = async subjects => {
    setImporting(true);
    try {
      const { data } = await subjectService.confirmImport(subjects);
      toast.success(data.message);
      if (data.skipped?.length) toast.info(`Already present: ${data.skipped.join(', ')}`);
      setPreview(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const handleEdit = s => {    setForm({
      name: s.name, code: s.code, instructor: s.instructor || '',
      credits: String(s.credits || 4),
      schedule: (s.schedule || []).map(sl => ({
        ...sl, startTime: sl.startTime || '09:00', endTime: sl.endTime || '10:00',
      })),
    });
    setEditing(s._id); setShowForm(true);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this subject?')) return;
    await subjectService.remove(id);
    toast.success('Subject deleted');
    load();
  };

  /* ── loading state ────────────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width="160px" height="26px" />
          <Skeleton width="260px" height="14px" />
        </div>
        <Skeleton variant="pill" width="120px" height="36px" />
      </div>
      {/* banner */}
      <Skeleton height="68px" style={{ borderRadius: 14 }} />
      {/* today strip */}
      <div style={{ ...card(), display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width="40%" height="16px" />
        <div style={{ display: 'flex', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} width="120px" height="56px" style={{ borderRadius: 10 }} />)}
        </div>
      </div>
      {/* tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}` }}>
        <Skeleton variant="pill" width="110px" height="14px" style={{ marginBottom: 12 }} />
        <Skeleton variant="pill" width="110px" height="14px" style={{ marginBottom: 12 }} />
      </div>
      {/* subject cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ ...card(), display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton variant="circle" width="36px" height="36px" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton width="70%" height="15px" />
                <Skeleton width="40%" height="12px" />
              </div>
            </div>
            <Skeleton height="1px" />
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton variant="pill" width="80px" height="22px" />
              <Skeleton variant="pill" width="80px" height="22px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <style>{`
        .tt-input {
          width: 100%; padding: 9px 12px;
          background: #1a1d2a; border: 1px solid rgba(255,255,255,0.09);
          border-radius: 9px; color: #f1f5f9; font-size: 13.5px;
          outline: none; transition: border-color 0.18s, box-shadow 0.18s;
          box-sizing: border-box;
        }
        .tt-input:focus {
          border-color: rgba(99,102,241,0.55);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .tt-label {
          display: block; font-size: 11.5px; font-weight: 500;
          color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
          margin-bottom: 5px;
        }
        .tt-btn-primary {
          padding: 9px 20px; border-radius: 10px; border: none; cursor: pointer;
          background: #6366f1; color: #fff; font-weight: 600; font-size: 13.5px;
          transition: background 0.18s, transform 0.15s;
        }
        .tt-btn-primary:hover { background: #4f46e5; transform: translateY(-1px); }
        .tt-btn-ghost {
          padding: 9px 16px; border-radius: 10px; cursor: pointer;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25);
          color: #818cf8; font-size: 13px; font-weight: 500;
          transition: background 0.18s;
        }
        .tt-btn-ghost:hover { background: rgba(99,102,241,0.18); }
        .tt-btn-outline {
          padding: 9px 16px; border-radius: 10px; cursor: pointer;
          background: transparent; border: 1px solid rgba(255,255,255,0.10);
          color: #64748b; font-size: 13px;
          transition: border-color 0.18s, color 0.18s;
        }
        .tt-btn-outline:hover { border-color: rgba(255,255,255,0.22); color: #94a3b8; }
        .tt-slot-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr 36px;
          gap: 10px; align-items: end;
        }
        .tt-sub-card:hover { border-color: rgba(255,255,255,0.14) !important; transform: translateY(-2px); }
        .tt-action-btn { background: transparent; border: none; cursor: pointer; padding: 6px; border-radius: 7px; transition: background 0.15s; }
        .tt-action-btn:hover { background: rgba(255,255,255,0.07); }
        @keyframes tt-spin-kf { to { transform: rotate(360deg); } }
        .tt-spin { animation: tt-spin-kf 0.9s linear infinite; flex-shrink: 0; }
        @media (max-width: 640px) {
          .tt-slot-grid { grid-template-columns: 1fr 1fr; }
          .tt-slot-del  { grid-column: span 2; }
        }
      `}</style>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 16,
        padding: '20px 22px', borderRadius: 16,
        background: 'linear-gradient(135deg, #0a0a0a 0%, #111111 100%)',
        border: `1px solid ${C.border2}`,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 20px 50px rgba(0,0,0,0.5)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
        }} />
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 800, color: C.text,
            display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.4px',
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
            }}>
              <Calendar size={18} color="#fff" />
            </span>
            <span style={{ color: '#818cf8', marginRight: 6 }}>StudentAI</span> Timetable
          </h1>
          <p style={{ margin: '6px 0 0 46px', fontSize: 13, color: C.textMuted }}>
            Your weekly class schedule — view, manage, and export
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfSelected}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => exportTimetablePDF(subjects)}
            disabled={subjects.length === 0}
            title="Download a clean white PDF — perfect for printing or viewing in light"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, cursor: subjects.length === 0 ? 'not-allowed' : 'pointer',
              background: subjects.length === 0 ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff', fontWeight: 700, fontSize: 13.5, border: 'none',
              boxShadow: subjects.length === 0 ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
              opacity: subjects.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={16} /> Download PDF
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            title="Upload your college timetable PDF — subjects and class times are read automatically"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, cursor: parsing ? 'wait' : 'pointer',
              background: 'rgba(255,255,255,0.04)', color: C.text, fontWeight: 600, fontSize: 13.5,
              border: `1px solid ${C.border2}`, opacity: parsing ? 0.6 : 1,
            }}
          >
            <Upload size={16} /> {parsing ? 'Reading PDF…' : 'Import PDF'}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', color: C.text, fontWeight: 600, fontSize: 13.5,
              border: `1px solid ${C.border2}`,
              transition: 'background 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <Plus size={16} /> Add Subject
          </button>
        </div>
      </div>

      {/* ── PDF import: what the button does, and progress while it runs ───── */}
      {!preview && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '11px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          color: C.textSub,
        }}>
          {parsing
            ? <Loader2 size={15} className="tt-spin" color="#a5b4fc" style={{ flexShrink: 0 }} />
            : <FileText size={15} color="#a5b4fc" style={{ flexShrink: 0 }} />}
          {parsing
            ? <span style={{ color: C.text }}>Reading your timetable — this can take up to a minute for a full week.</span>
            : <span>
                Have a timetable PDF?{' '}
                <strong style={{ color: C.text, fontWeight: 600 }}>Import from PDF</strong>{' '}
                pulls in every subject and class time at once — you review and edit everything before it saves.
              </span>}
        </div>
      )}

      {/* ── PDF import review ─────────────────────────────────────────────── */}
      {preview && (
        <TimetableImportPreview
          entries={preview.entries}
          fileName={preview.fileName}
          existingSubjects={subjects}
          saving={importing}
          onConfirm={handleConfirmImport}
          onCancel={() => setPreview(null)}
        />
      )}

      {/* ── Live class banner ─────────────────────────────────────────────── */}
      {(currentClass || nextClass) && (() => {
        const cls    = currentClass || nextClass;
        const isCurr = !!currentClass;
        const col    = subjectColor(cls.colorIdx || 0);
        return (
          <div style={{
            padding: '14px 20px', borderRadius: 14,
            background: isCurr
              ? 'linear-gradient(135deg,rgba(16,185,129,0.14),rgba(20,184,166,0.07))'
              : 'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(129,140,248,0.06))',
            border: `1px solid ${isCurr ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: isCurr ? 'rgba(16,185,129,0.15)' : C.accentMid,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isCurr
                ? <Clock size={20} color={C.success} />
                : <ChevronRight size={20} color={C.accent} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                {isCurr
                  ? `Now in progress · ${cls.name}`
                  : `Up next · ${cls.name}`}
              </div>
              <div style={{ fontSize: 12, color: C.textSub, marginTop: 3 }}>
                {isCurr
                  ? `Ends at ${fmt12(cls.endTime)}${cls.room ? ` · Room ${cls.room}` : ''}`
                  : `Starts at ${fmt12(cls.startTime)} · in ${Math.round(toMinutes(cls.startTime) - nowMin)} min${cls.room ? ` · Room ${cls.room}` : ''}`}
              </div>
            </div>
            {isCurr && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(16,185,129,0.15)', color: C.success,
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, display: 'inline-block', animation: 'pulse 2s infinite' }} />
                LIVE
              </span>
            )}
          </div>
        );
      })()}

      {/* ── Today's schedule strip ────────────────────────────────────────── */}
      {todayClasses.length > 0 && (
        <div style={{ ...card() }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <Clock size={15} color={C.accent} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
              Today's Schedule
            </span>
            <span style={{
              marginLeft: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11,
              background: C.accentMid, color: '#818cf8', fontWeight: 500,
            }}>
              {todayName} · {todayClasses.length} class{todayClasses.length > 1 ? 'es' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {todayClasses.map((c, i) => {
              const isPast    = toMinutes(c.endTime)   < nowMin;
              const isCurrent = toMinutes(c.startTime) <= nowMin && toMinutes(c.endTime) > nowMin;
              const col       = subjectColor(c.colorIdx || i);
              return (
                <div key={i} style={{
                  padding: '10px 16px', borderRadius: 12, minWidth: 130,
                  background: isCurrent ? 'rgba(16,185,129,0.12)' : isPast ? 'rgba(255,255,255,0.03)' : col.bg,
                  border: `1px solid ${isCurrent ? 'rgba(16,185,129,0.3)' : isPast ? 'rgba(255,255,255,0.05)' : col.border}`,
                  opacity: isPast ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isPast ? C.textMuted : C.text }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: C.textSub, marginTop: 3 }}>
                    {fmt12(c.startTime)} – {fmt12(c.endTime)}
                    {c.room && <span style={{ color: C.textMuted }}> · {c.room}</span>}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 10.5, color: C.success, marginTop: 5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, display: 'inline-block' }} />
                      In progress
                    </div>
                  )}
                  {!isCurrent && !isPast && (
                    <div style={{ fontSize: 10.5, color: col.dot, marginTop: 5, fontWeight: 500 }}>
                      In {Math.round(toMinutes(c.startTime) - nowMin)} min
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add / Edit form ───────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ ...card(), border: `1px solid rgba(99,102,241,0.25)`, background: '#14172199' }}>
          {/* form header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>
                {editing ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textMuted }}>
                Fill in subject details and schedule slots
              </p>
            </div>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null); }}
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.textSub }}
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Basic fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Subject Name', name: 'name',       placeholder: 'Data Structures',  required: true },
                { label: 'Subject Code', name: 'code',       placeholder: 'CS301',            required: true },
                { label: 'Instructor',   name: 'instructor', placeholder: 'Prof. Sharma',     required: false },
              ].map(f => (
                <div key={f.name}>
                  <label className="tt-label">{f.label}</label>
                  <input
                    className="tt-input" type="text" name={f.name}
                    value={form[f.name]} onChange={handleChange}
                    placeholder={f.placeholder} required={f.required}
                  />
                </div>
              ))}
              <div>
                <label className="tt-label">Credits</label>
                <select className="tt-input" name="credits" value={form.credits} onChange={handleChange}>
                  {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{c} Credits</option>)}
                </select>
              </div>
            </div>

            {/* Schedule slots */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="tt-label" style={{ marginBottom: 0 }}>Schedule Slots</label>
                <button type="button" className="tt-btn-ghost" onClick={addSlot}
                  style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={13} /> Add Slot
                </button>
              </div>

              {(form.schedule || []).length === 0 && (
                <div style={{
                  padding: '18px', borderRadius: 10, textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.border2}`,
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>No slots yet — click "Add Slot" to schedule this subject.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(form.schedule || []).map((slot, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                    borderRadius: 11, padding: '12px 14px',
                  }}>
                    <div className="tt-slot-grid">
                      {[
                        { label: 'Day',   el: (
                          <select className="tt-input" value={slot.day} onChange={e => handleSlotChange(i, 'day', e.target.value)}>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        )},
                        { label: 'Start', el: <input className="tt-input" type="time" value={slot.startTime} onChange={e => handleSlotChange(i, 'startTime', e.target.value)} /> },
                        { label: 'End',   el: <input className="tt-input" type="time" value={slot.endTime}   onChange={e => handleSlotChange(i, 'endTime',   e.target.value)} /> },
                        { label: 'Room',  el: <input className="tt-input" type="text" value={slot.room}      onChange={e => handleSlotChange(i, 'room', e.target.value)} placeholder="LH-101" /> },
                      ].map(({ label, el }) => (
                        <div key={label}>
                          {i === 0 && <label className="tt-label">{label}</label>}
                          {el}
                        </div>
                      ))}
                      <button type="button" className="tt-slot-del" onClick={() => removeSlot(i)}
                        style={{
                          background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`,
                          color: C.danger, borderRadius: 8, padding: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          alignSelf: i === 0 ? 'flex-end' : 'center',
                        }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="tt-btn-primary" type="submit">
                {editing ? 'Update Subject' : 'Add Subject'}
              </button>
              <button type="button" className="tt-btn-outline" onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      {subjects.length > 0 && (
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}` }}>
          {[
            { key: 'grid', label: 'Weekly Grid', icon: LayoutGrid },
            { key: 'list', label: 'Subjects',    icon: BookOpen },
          ].map(t => {
            const active = tab === t.key;
            const Icon   = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                color: active ? C.text : C.textMuted,
                cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: 13,
                transition: 'all 0.18s', marginBottom: -1,
              }}>
                <Icon size={15} />
                {t.label}
                {t.key === 'list' && subjects.length > 0 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 20, fontSize: 11,
                    background: active ? C.accentMid : 'rgba(255,255,255,0.06)',
                    color: active ? '#818cf8' : C.textMuted, fontWeight: 500,
                  }}>
                    {subjects.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Weekly grid view ──────────────────────────────────────────────── */}
      {subjects.length > 0 && tab === 'grid' && (
        <WeeklyGrid subjects={subjects} />
      )}

      {/* ── Subject list — card grid ───────────────────────────────────────── */}
      {subjects.length > 0 && tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {subjects.map((s, si) => {
            const col = subjectColor(si);
            return (
              <div key={s._id} className="tt-sub-card" style={{
                ...card({ padding: '18px 20px' }),
                transition: 'border-color 0.18s, transform 0.18s',
                cursor: 'default',
              }}>
                {/* card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: col.bg, border: `1px solid ${col.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <BookOpen size={18} color={col.dot} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: col.bg, color: col.dot, border: `1px solid ${col.border}`,
                      }}>
                        {s.code}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11,
                        background: 'rgba(255,255,255,0.04)', color: C.textSub,
                      }}>
                        {s.credits} cr
                      </span>
                    </div>
                  </div>
                  {/* actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="tt-action-btn" onClick={() => handleEdit(s)} title="Edit">
                      <Edit size={14} color={C.textSub} />
                    </button>
                    <button className="tt-action-btn" onClick={() => handleDelete(s._id)} title="Delete"
                      style={{ ':hover': { background: 'rgba(239,68,68,0.1)' } }}>
                      <Trash2 size={14} color={C.danger} />
                    </button>
                  </div>
                </div>

                {/* divider */}
                <div style={{ height: 1, background: C.border, marginBottom: 12 }} />

                {/* instructor */}
                {s.instructor && (
                  <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.textMuted, display: 'inline-block' }} />
                    {s.instructor}
                  </div>
                )}

                {/* schedule slots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(s.schedule || []).length > 0
                    ? s.schedule.map((sl, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                        }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700,
                            color: col.dot, minWidth: 28, textAlign: 'center',
                          }}>
                            {sl.day}
                          </span>
                          <span style={{ width: 1, height: 14, background: C.border, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: C.textSub }}>
                            {fmt12(sl.startTime)} – {fmt12(sl.endTime)}
                          </span>
                          {sl.room && (
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>
                              {sl.room}
                            </span>
                          )}
                        </div>
                      ))
                    : <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>No schedule set</div>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {subjects.length === 0 && !showForm && (
        <EmptyState
          title="No subjects added"
          subtitle="Create your academic subjects to populate the weekly schedule and manage classes."
          actionLabel="Add Subject"
          onAction={() => { setShowForm(true); setEditing(null); setForm(EMPTY); }}
        />
      )}
    </div>
  );
}