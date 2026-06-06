import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from '../context/ToastContext';
import { GraduationCap, User, Mail, Lock, Building, IdCard, ArrowRight, BarChart2, Bot, Rocket, Bell, Calendar } from 'lucide-react';
import './Signup.css';

export default function Signup() {
 const [form, setForm] = useState({
    name: '', email: '', password: '', college: '', semester: 1, branch: '', sid: '',
  });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.signup(form);
      login(data.user, data.token);
      toast.success('Account created! Welcome 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Full Name',  name: 'name',     type: 'text',     placeholder: 'Your full name' },
    { label: 'Email',      name: 'email',    type: 'email',    placeholder: 'you@college.edu' },
    { label: 'Password',   name: 'password', type: 'password', placeholder: 'Min. 6 characters' },
    { label: 'College',    name: 'college',  type: 'text',     placeholder: 'Your college name' },
    { label: 'Branch',     name: 'branch',   type: 'text',     placeholder: 'CSE / IT / ECE…' },
    { label: 'Student ID', name: 'sid',      type: 'text',     placeholder: 'e.g. 2201234' },
  ];

  return (
    <div className="signup-page">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="grid-overlay" />

      <div className="signup-wrapper">
        {/* Left branding panel */}
        <div className="brand-panel">
          <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-accent)' }}>
            <GraduationCap size={44} />
          </div>
          <h1 className="brand-title">StudentAI</h1>
          <p className="brand-tagline">Your smart academic companion for better grades and placement success.</p>

          <div className="brand-features">
            {[
              { icon: <BarChart2 size={16} />, text: 'Track CGPA & attendance' },
              { icon: <Bot size={16} />, text: 'AI-powered suggestions'  },
              { icon: <Rocket size={16} />, text: 'Career prep roadmaps'    },
              { icon: <Bell size={16} />, text: 'Smart notifications'     },
            ].map(f => (
              <div className="brand-feature" key={f.text}>
                <span className="feature-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          <div className="brand-dots">
            <span className="dot active" /><span className="dot" /><span className="dot" />
          </div>
        </div>

        {/* Right form panel */}
        <div className="form-panel">
          <div className="form-header">
            <h2 className="form-title">Create your account</h2>
            <p className="form-subtitle">Join thousands of students already using StudentAI</p>
          </div>

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="fields-grid">
              {fields.map(f => (
                <div className={`field-group ${focused === f.name ? 'field-focused' : ''}`} key={f.name}>
                  <label className="field-label">{f.label}</label>
                  <div className="field-input-wrap">
                    <span className="field-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {f.name === 'name' && <User size={16} />}
                      {f.name === 'email' && <Mail size={16} />}
                      {f.name === 'password' && <Lock size={16} />}
                      {f.name === 'college' && <Building size={16} />}
                      {f.name === 'branch' && <GraduationCap size={16} />}
                      {f.name === 'sid' && <IdCard size={16} />}
                    </span>
                    <input
                      className="field-input"
                      type={f.type}
                      name={f.name}
                      value={form[f.name]}
                      onChange={handleChange}
                      onFocus={() => setFocused(f.name)}
                      onBlur={() => setFocused('')}
                      placeholder={f.placeholder}
                      required
                    />
                  </div>
                </div>
              ))}

              <div className={`field-group ${focused === 'semester' ? 'field-focused' : ''}`}>
                <label className="field-label">Semester</label>
                <div className="field-input-wrap">
                  <span className="field-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={16} /></span>
                  <select
                    className="field-input field-select"
                    name="semester"
                    value={form.semester}
                    onChange={handleChange}
                    onFocus={() => setFocused('semester')}
                    onBlur={() => setFocused('')}
                  >
                    {[1,2,3,4,5,6,7,8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button className={`signup-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {loading ? (
                <span className="btn-spinner" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="signin-link">
            Already have an account?{' '}
            <Link to="/login" className="signin-anchor">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
