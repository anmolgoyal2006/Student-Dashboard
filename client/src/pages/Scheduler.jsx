import { useEffect, useState, useMemo } from 'react';
import { taskService, subjectService } from '../services/apiServices';
import toast from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, StatsSkeleton } from '../components/Skeleton';
import ClassroomConnect from '../components/ClassroomConnect';
import { Calendar, Clock, ListTodo, Play, AlertTriangle, Edit3, Plus, Trash2, ClipboardList, BookOpen, Rocket, RefreshCw, Pin } from 'lucide-react';
import useResponsive from '../utils/useResponsive';

const PRIORITY_COLOR = {
  critical:{ bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',   text: 'var(--color-danger)', badge: 'badge-danger'  },
  high:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', text: 'var(--color-danger)', badge: 'badge-danger'  },
  medium: { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  text: 'var(--color-warning)', badge: 'badge-warning' },
  low:    { bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)',  text: 'var(--color-success)', badge: 'badge-success' },
};

const STATUS_BADGE = {
  pending:     'badge-warning',
  'in-progress': 'badge-info',
  completed:   'badge-success',
};

const TYPE_ICON = {
  assignment: 'assignment',
  exam:       'exam',
  project:    'project',
  revision:   'revision',
  other:      'other',
};

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY = {
  title: '', subject: '', description: '',
  dueDate: '', dueTime: '23:59',
  priority: 'medium', status: 'pending', type: 'other',
};

function getWeekDates(offset = 0) {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}


// Dynamic type icon renderer to replace hardcoded emojis
const renderTypeIcon = (type) => {
  const style = { display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: '6px' };
  if (type === 'assignment') return <ClipboardList size={14} style={style} />;
  if (type === 'exam') return <BookOpen size={14} style={style} />;
  if (type === 'project') return <Rocket size={14} style={style} />;
  if (type === 'revision') return <RefreshCw size={14} style={style} />;
  return <Pin size={14} style={style} />;
};


export default function Scheduler() {
  const [tasks,    setTasks]    = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('week');   // 'week' | 'list'
  const { isMobile } = useResponsive();
  const [weekOff,  setWeekOff]  = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [filter,   setFilter]   = useState({ status: '', priority: '', type: '' });

  const weekDates = useMemo(() => getWeekDates(weekOff), [weekOff]);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([
        taskService.getAll(),
        subjectService.getAll(),
      ]);
      setTasks(t.data.tasks || []);
      setSubjects(s.data.subjects || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); window.addEventListener('classroom-changed', load); return () => window.removeEventListener('classroom-changed', load); }, []);

  const handleChange = e =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = task => {
    setForm({
      title:       task.title,
      subject:     task.subject,
      description: task.description || '',
      dueDate:     task.dueDate?.slice(0, 10),
      dueTime:     task.dueTime || '23:59',
      priority:    task.priority,
      status:      task.status,
      type:        task.type,
    });
    setEditing(task._id);
    setShowForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (editing) {
        await taskService.update(editing, form);
        toast.success('Task updated');
      } else {
        await taskService.create(form);
        toast.success('Task added');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this task?')) return;
    // Optimistic: remove immediately, restore the row if the server rejects.
    const prev = tasks;
    setTasks(curr => curr.filter(t => t._id !== id));
    try {
      await taskService.remove(id);
      toast.success('Task deleted');
    } catch {
      setTasks(prev);
      toast.error('Failed to delete');
    }
  };

  // Mirrors the server's status cycle so the UI can update before the round trip.
  const STATUS_CYCLE = { pending: 'in-progress', 'in-progress': 'completed', completed: 'pending' };

  const handleToggle = async id => {
    // Optimistic: advance the status locally now, reconcile with the server's
    // returned task, and roll back to the previous status on failure.
    const prev = tasks;
    setTasks(curr => curr.map(t =>
      t._id === id ? { ...t, status: STATUS_CYCLE[t.status] || t.status } : t
    ));
    try {
      const res = await taskService.toggle(id);
      const updated = res?.data?.task;
      if (updated) {
        setTasks(curr => curr.map(t => (t._id === id ? updated : t)));
      }
    } catch {
      setTasks(prev);
      toast.error('Failed to update status');
    }
  };

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filter.status   && t.status   !== filter.status)   return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.type     && t.type     !== filter.type)     return false;
    return true;
  });

  // Stats
  const stats = {
    total:     tasks.length,
    pending:   tasks.filter(t => t.status === 'pending').length,
    inProgress:tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue:   tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length,
  };

  if (loading) return (
    <div>
      <StatsSkeleton count={4} />
      <div style={{ marginTop: 16 }}>
        <CardSkeleton count={3} />
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={20} style={{ color: 'var(--color-accent)' }} />
            Smart scheduler
          </h1>
          <p className="page-subtitle">Manage tasks, deadlines and your weekly plan</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Task</button>
      </div>

      {/* ── Google Classroom ── */}
      <div style={{ marginBottom: 16 }}>
        <ClassroomConnect onSync={load} />
      </div>

      {/* ── Stat row ── */}
      <div className="grid-4 mb-4">
        {[
          { label: 'Total',       value: stats.total,      icon: <ListTodo size={16} />, color: 'var(--color-accent)' },
          { label: 'Pending',     value: stats.pending,    icon: <Clock size={16} />, color: 'var(--color-warning)'        },
          { label: 'In Progress', value: stats.inProgress, icon: <Play size={16} />, color: 'var(--color-accent)'        },
          { label: 'Overdue',     value: stats.overdue,    icon: <AlertTriangle size={16} />, color: 'var(--color-danger)'        },
        ].map(s => (
          <div className="card stat-card" key={s.label}>
            <span className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</span>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <div className="card mb-4">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {editing ? (
              <>
                <Edit3 size={16} style={{ color: 'var(--color-accent)' }} />
                Edit Task
              </>
            ) : (
              <>
                <Plus size={16} style={{ color: 'var(--color-accent)' }} />
                Add New Task
              </>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              {/* Title */}
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input
                  className="form-input"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Submit Assignment"
                  required
                />
              </div>

              {/* Subject */}
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                >
                  <option value="General">General</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label className="form-label">Due Date *</label>
                <input
                  className="form-input"
                  type="date"
                  name="dueDate"
                  value={form.dueDate}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Due Time */}
              <div className="form-group">
                <label className="form-label">Due Time</label>
                <input
                  className="form-input"
                  type="time"
                  name="dueTime"
                  value={form.dueTime}
                  onChange={handleChange}
                />
              </div>

              {/* Type */}
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                  {['assignment','exam','project','revision','other'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" name="priority" value={form.priority} onChange={handleChange}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit">
                {editing ? 'Update Task' : 'Add Task'}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── View Toggle + Filters ── */}
      <div className="card mb-4">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>

          {/* View switcher */}
          <div style={{ display: 'flex', gap: 8 }}>
            {['week', 'list'].map(v => (
              <button
                key={v}
                className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setView(v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {v === 'week' ? (
                  <>
                    <Calendar size={14} />
                    Week
                  </>
                ) : (
                  <>
                    <ListTodo size={14} />
                    List
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={filter.status}
              onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={filter.priority}
              onChange={e => setFilter(p => ({ ...p, priority: e.target.value }))}
            >
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={filter.type}
              onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}
            >
              <option value="">All Types</option>
              {['assignment','exam','project','revision','other'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Week View ── */}
      {view === 'week' && (
        <div className="card">
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekOff(w => w - 1)}>← Prev</button>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setWeekOff(0)}>Today</button>
              <button className="btn btn-outline btn-sm" onClick={() => setWeekOff(w => w + 1)}>Next →</button>
            </div>
          </div>

          {/* Calendar grid */}
          {isMobile ? (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {weekDates.map((date, i) => {
                const isToday    = isSameDay(date, new Date());
                const dayTasks   = filteredTasks.filter(t => isSameDay(new Date(t.dueDate), date));
                return (
                  <div key={i} style={{
                    minWidth: 140, flexShrink: 0,
                    background: isToday ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isToday ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '10px 8px', minHeight: 120,
                  }}>
                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {DAYS[date.getDay()]}
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text)',
                        width: 32, height: 32, borderRadius: '50%',
                        background: isToday ? 'rgba(129,140,248,0.15)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '4px auto 0',
                      }}>
                        {date.getDate()}
                      </div>
                    </div>
                    {dayTasks.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>—</div>
                    ) : (
                      dayTasks.map(task => {
                        const pc = PRIORITY_COLOR[task.priority];
                        const isOverdue = task.status !== 'completed' && new Date(task.dueDate) < new Date();
                        return (
                          <div key={task._id} onClick={() => openEdit(task)}
                            style={{
                              background: isOverdue ? 'rgba(248,113,113,0.1)' : pc.bg,
                              border: `1px solid ${isOverdue ? 'rgba(248,113,113,0.3)' : pc.border}`,
                              borderRadius: 6, padding: '5px 7px', marginBottom: 5, cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                              {renderTypeIcon(task.type)} {task.title.length > 12 ? task.title.slice(0, 12) + '…' : task.title}
                            </div>
                            <div style={{ fontSize: 10, color: pc.text, marginTop: 2 }}>{task.dueTime}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))',
            gap: 8,
            overflowX: 'auto',
          }}>
            {weekDates.map((date, i) => {
              const isToday    = isSameDay(date, new Date());
              const dayTasks   = filteredTasks.filter(t => isSameDay(new Date(t.dueDate), date));

              return (
                <div key={i} style={{
                  minWidth: 110,
                  background: isToday ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isToday ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '10px 8px',
                  minHeight: 120,
                }}>
                  {/* Day header */}
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}>
                      {DAYS[date.getDay()]}
                    </div>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: isToday ? 'var(--primary)' : 'var(--text)',
                      width: 32, height: 32,
                      borderRadius: '50%',
                      background: isToday ? 'rgba(129,140,248,0.15)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '4px auto 0',
                    }}>
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Tasks for this day */}
                  {dayTasks.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>—</div>
                  ) : (
                    dayTasks.map(task => {
                      const pc = PRIORITY_COLOR[task.priority];
                      const isOverdue = task.status !== 'completed' && new Date(task.dueDate) < new Date();
                      return (
                        <div
                          key={task._id}
                          onClick={() => openEdit(task)}
                          style={{
                            background: isOverdue ? 'rgba(248,113,113,0.1)' : pc.bg,
                            border: `1px solid ${isOverdue ? 'rgba(248,113,113,0.3)' : pc.border}`,
                            borderRadius: 6,
                            padding: '5px 7px',
                            marginBottom: 5,
                            cursor: 'pointer',
                            transition: 'transform 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                            {renderTypeIcon(task.type)} {task.title.length > 14 ? task.title.slice(0, 14) + '…' : task.title}
                          </div>
                          <div style={{ fontSize: 10, color: pc.text, marginTop: 2 }}>
                            {task.dueTime} · {task.priority}
                          </div>
                          {task.status === 'completed' && (
                            <div style={{ fontSize: 10, color: 'var(--color-success)', marginTop: 1 }}>✓ Done</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListTodo size={16} style={{ color: 'var(--color-accent)' }} />
            All Tasks ({filteredTasks.length})
          </div>
          {filteredTasks.length === 0 ? (
            <EmptyState
              title="No tasks found"
              subtitle="Get started by adding your first task or checking other categories."
              actionLabel="+ Add Task"
              onAction={openAdd}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Subject</th>
                    <th>Due</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => {
                    const isOverdue = task.status !== 'completed' && new Date(task.dueDate) < new Date();
                    return (
                      <tr key={task._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: isOverdue ? 'var(--color-danger)' : 'var(--text)', fontSize: 13 }}>
                            {task.title}
                          </div>
                          {isOverdue && (
                            <span style={{ fontSize: 10, color: 'var(--color-danger)', fontWeight: 600, display: 'inline-block', marginTop: 2 }}>⚠ OVERDUE</span>
                          )}
                          {task.description && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{task.description}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>{task.subject || '—'}</td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{task.dueTime}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{renderTypeIcon(task.type)} {task.type}</td>
                        <td>
                          <span className={`badge ${PRIORITY_COLOR[task.priority].badge}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggle(task._id)}
                            className={`badge ${STATUS_BADGE[task.status]}`}
                            style={{ border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
                          >
                            <span className={`badge ${STATUS_BADGE[task.status]}`}>
                              {task.status}
                            </span>
                          </button>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(task)}>Edit</button>
                            <button className="btn btn-danger btn-sm"  onClick={() => handleDelete(task._id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}