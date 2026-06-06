import { useEffect, useState, useMemo } from 'react';
import { subjectService } from '../services/apiServices';
import toast from '../context/ToastContext';
import WeeklyGrid from '../components/WeeklyGrid';
import EmptyState from '../components/EmptyState';
import { LayoutGrid, List, Plus, Edit, Trash2, Calendar, Clock } from 'lucide-react';

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMPTY = { name: '', code: '', instructor: '', credits: 4, schedule: [] };

const EMPTY_SLOT = { day: 'Mon', startTime: '09:00', endTime: '10:00', room: '' };

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
};

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export default function Timetable() {
  const [subjects, setSubjects] = useState([]);
  const [form,     setForm]     = useState(EMPTY);
  const [editing,  setEditing]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab,      setTab]      = useState('grid'); // 'grid' | 'list'

  const load = async () => {
    try {
      const { data } = await subjectService.getAll();
      setSubjects(data.subjects);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── Today's classes ──────────────────────────────────── */
  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayName = dayNames[new Date().getDay()];
  const nowMin    = new Date().getHours() * 60 + new Date().getMinutes();

  const todayClasses = useMemo(() => {
    const classes = [];
    subjects.forEach(s => {
      (s.schedule || []).filter(sl => sl.day === todayName).forEach(sl => {
        classes.push({ ...sl, name: s.name, code: s.code, subjectId: s._id });
      });
    });
    return classes.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  }, [subjects, todayName]);

  const nextClass = useMemo(() => {
    return todayClasses.find(c => toMinutes(c.startTime) > nowMin) || null;
  }, [todayClasses, nowMin]);

  const currentClass = useMemo(() => {
    return todayClasses.find(c =>
      toMinutes(c.startTime) <= nowMin && toMinutes(c.endTime) > nowMin
    ) || null;
  }, [todayClasses, nowMin]);

  /* ── Form handlers ────────────────────────────────────── */
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSlotChange = (i, field, val) => {
    setForm(p => {
      const slots = [...(p.schedule || [])];
      slots[i] = { ...slots[i], [field]: val };
      return { ...p, schedule: slots };
    });
  };

  const addSlot    = () => setForm(p => ({ ...p, schedule: [...(p.schedule || []), { ...EMPTY_SLOT }] }));
  const removeSlot = (i) => setForm(p => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (editing) {
        await subjectService.update(editing, form);
        toast.success('Subject updated');
      } else {
        await subjectService.add(form);
        toast.success('Subject added');
      }
      setForm(EMPTY); setEditing(null); setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = s => {
    setForm({
      name      : s.name,
      code      : s.code,
      instructor: s.instructor || '',
      credits   : String(s.credits || 4),
      schedule  : (s.schedule || []).map(sl => ({
        ...sl,
        startTime: sl.startTime || '09:00',
        endTime  : sl.endTime   || '10:00',
      })),
    });
    setEditing(s._id);
    setShowForm(true);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this subject?')) return;
    await subjectService.remove(id);
    toast.success('Subject deleted');
    load();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <style>{`
        .timetable-slot-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr auto;
          gap: 8px;
          margin-bottom: 12px;
          align-items: end;
        }
        .timetable-slot-row label {
          display: block;
        }
        @media (min-width: 601px) {
          .timetable-slot-row-subsequent label {
            display: none;
          }
        }
        @media (max-width: 600px) {
          .timetable-slot-row {
            grid-template-columns: 1fr 1fr;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.02);
            padding: 12px;
            border-radius: 10px;
            gap: 10px;
          }
          .timetable-slot-delete-btn {
            grid-column: span 2;
            margin-top: 4px;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
        }
      `}</style>
      
      {/* ── Page header ──────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={20} style={{ color: 'var(--color-accent)' }} />
            Timetable
          </h1>
          <p className="page-subtitle">Weekly schedule and subject management</p>
        </div>
        <button 
          className="btn" 
          style={{
            border: '1px solid var(--color-accent)',
            background: 'transparent',
            color: 'var(--color-accent)',
            transition: 'background 0.2s',
            fontWeight: 500,
            borderRadius: 'var(--radius-md)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-muted)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY); }}
        >
          + Add Subject
        </button>
      </div>

      {/* ── Next / Current class banner ───────────────────── */}
      {(currentClass || nextClass) && (
        <div style={{
          padding: '14px 20px', borderRadius: 12, marginBottom: 16,
          background: currentClass
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.08))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(20,184,166,0.08))',
          border: `1px solid ${currentClass ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentClass ? 'var(--color-success)' : 'var(--color-accent)' }}>
            {currentClass ? <Clock size={20} /> : <Calendar size={20} />}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {currentClass
                ? `Now: ${currentClass.name} (${fmt12(currentClass.startTime)} – ${fmt12(currentClass.endTime)})`
                : `Next: ${nextClass.name} at ${fmt12(nextClass.startTime)}`
              }
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {currentClass
                ? `Ends at ${fmt12(currentClass.endTime)}${currentClass.room ? ` · Room ${currentClass.room}` : ''}`
                : `Starts in ${Math.round(toMinutes(nextClass.startTime) - nowMin)} minutes${nextClass.room ? ` · Room ${nextClass.room}` : ''}`
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Today's schedule strip ───────────────────────── */}
      {todayClasses.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} style={{ color: 'var(--color-accent)' }} />
            Today's Schedule — {todayName}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {todayClasses.map((c, i) => {
              const isPast    = toMinutes(c.endTime) < nowMin;
              const isCurrent = toMinutes(c.startTime) <= nowMin && toMinutes(c.endTime) > nowMin;
              return (
                <div key={i} style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: isCurrent
                    ? 'rgba(16,185,129,0.15)'
                    : isPast
                    ? 'rgba(255,255,255,0.02)'
                    : 'var(--color-accent-muted)',
                  border: `1px solid ${isCurrent ? 'rgba(16,185,129,0.3)' : isPast ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.2)'}`,
                  opacity: isPast ? 0.5 : 1,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {fmt12(c.startTime)} – {fmt12(c.endTime)}
                    {c.room ? ` · ${c.room}` : ''}
                  </div>
                  {isCurrent && <div style={{ fontSize: 10, color: 'var(--color-success)', marginTop: 3, fontWeight: 500 }}>● In progress</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add/Edit form ─────────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">{editing ? 'Edit Subject' : 'Add New Subject'}</div>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              {[
                { label: 'Subject Name', name: 'name',       placeholder: 'Data Structures' },
                { label: 'Subject Code', name: 'code',       placeholder: 'CS301' },
                { label: 'Instructor',   name: 'instructor', placeholder: 'Prof. Sharma' },
              ].map(f => (
                <div className="form-group" key={f.name}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type="text" name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} required={f.name !== 'instructor'} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Credits</label>
                <select className="form-select" name="credits" value={form.credits} onChange={handleChange}>
                  {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{c} Credits</option>)}
                </select>
              </div>
            </div>

            {/* Schedule slots */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Schedule Slots</label>
              {(form.schedule || []).map((slot, i) => (
                <div key={i} className={`timetable-slot-row${i > 0 ? ' timetable-slot-row-subsequent' : ''}`}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Day</label>
                    <select className="form-select" value={slot.day} onChange={e => handleSlotChange(i, 'day', e.target.value)}>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start</label>
                    <input className="form-input" type="time" value={slot.startTime} onChange={e => handleSlotChange(i, 'startTime', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">End</label>
                    <input className="form-input" type="time" value={slot.endTime} onChange={e => handleSlotChange(i, 'endTime', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Room</label>
                    <input className="form-input" type="text" value={slot.room} onChange={e => handleSlotChange(i, 'room', e.target.value)} placeholder="LH-101" />
                  </div>
                  <button type="button" onClick={() => removeSlot(i)} className="timetable-slot-delete-btn"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ))}
              {(form.schedule || []).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No slots added. Click "+ Add Slot" to schedule this subject.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">{editing ? 'Update Subject' : 'Add Subject'}</button>
              <button type="button" className="btn" onClick={addSlot} style={{ background: 'var(--color-accent-muted)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--color-accent)' }}>+ Add Slot</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab switcher ─────────────────────────────────── */}
      {subjects.length > 0 && (
        <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[
            { key: 'grid', label: 'Weekly Grid', icon: LayoutGrid },
            { key: 'list', label: 'Subject List', icon: List }
          ].map(t => {
            const active = tab === t.key;
            const IconComponent = t.icon;
            return (
              <button 
                key={t.key} 
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: active ? 500 : 400,
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
              >
                <IconComponent size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Weekly grid view ─────────────────────────────── */}
      {subjects.length > 0 && tab === 'grid' && (
        <div className="card">
          <WeeklyGrid subjects={subjects} />
        </div>
      )}

      {/* ── Subject list view ────────────────────────────── */}
      {subjects.length > 0 && tab === 'list' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Subject</th><th>Code</th><th>Instructor</th><th>Credits</th><th>Schedule</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="badge badge-primary">{s.code}</span></td>
                    <td>{s.instructor || '—'}</td>
                    <td>{s.credits}</td>
                    <td>
                      {(s.schedule || []).length > 0
                        ? s.schedule.map((sl, i) => (
                            <span key={i} style={{ display: 'inline-block', marginRight: 6, marginBottom: 3, padding: '2px 8px', borderRadius: 6, background: 'var(--color-accent-muted)', color: 'var(--color-accent)', fontSize: 11, fontWeight: 500 }}>
                              {sl.day} {fmt12(sl.startTime)}
                            </span>
                          ))
                        : <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>No schedule</span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(s)}><Edit size={14} /></button>
                        <button className="btn btn-danger btn-sm"  onClick={() => handleDelete(s._id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subjects.length === 0 && !showForm && (
        <EmptyState
          title="No subjects added"
          subtitle="Create your academic subjects to populate the weekly schedule and manage classes."
          actionLabel="+ Add Subject"
          onAction={() => { setShowForm(true); setEditing(null); setForm(EMPTY); }}
        />
      )}
    </div>
  );
}