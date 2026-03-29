import { useEffect, useState } from 'react';
import { subjectService } from '../services/apiServices';
import toast from 'react-hot-toast';

const DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const EMPTY   = { name: '', code: '', instructor: '', credits: 3, schedule: [] };

export default function Timetable() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [editing, setEditing]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const { data } = await subjectService.getAll();
      setSubjects(data.subjects);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

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
    setForm({ name: s.name, code: s.code, instructor: s.instructor, credits: s.credits, schedule: s.schedule });
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
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Timetable</h1>
          <p className="page-subtitle">Manage your subjects and schedule</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY); }}>
          + Add Subject
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-title">{editing ? 'Edit Subject' : 'Add New Subject'}</div>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              {[
                { label: 'Subject Name', name: 'name',       type: 'text',   placeholder: 'Data Structures' },
                { label: 'Subject Code', name: 'code',       type: 'text',   placeholder: 'CS301' },
                { label: 'Instructor',   name: 'instructor', type: 'text',   placeholder: 'Prof. Sharma' },
              ].map(f => (
                <div className="form-group" key={f.name}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} required={f.name !== 'instructor'} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Credits</label>
                <select className="form-select" name="credits" value={form.credits} onChange={handleChange}>
                  {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{c} Credits</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">{editing ? 'Update' : 'Add Subject'}</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📚</div>
          <p>No subjects added yet. Click "Add Subject" to start.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th><th>Code</th><th>Instructor</th><th>Credits</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="badge badge-primary">{s.code}</span></td>
                    <td>{s.instructor || '—'}</td>
                    <td>{s.credits}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(s)}>Edit</button>
                        <button className="btn btn-danger btn-sm"  onClick={() => handleDelete(s._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
