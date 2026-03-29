import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './Signup.css';

export default function Signup() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', college: '', semester: 1, branch: '',
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
    { label: 'Full Name',  name: 'name',     type: 'text',     placeholder: 'Your full name',    icon: '👤' },
    { label: 'Email',      name: 'email',    type: 'email',    placeholder: 'you@college.edu',    icon: '✉️' },
    { label: 'Password',   name: 'password', type: 'password', placeholder: 'Min. 6 characters',  icon: '🔒' },
    { label: 'College',    name: 'college',  type: 'text',     placeholder: 'Your college name',  icon: '🏛️' },
    { label: 'Branch',     name: 'branch',   type: 'text',     placeholder: 'CSE / IT / ECE…',    icon: '📐' },
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
          <div className="brand-logo">🎓</div>
          <h1 className="brand-title">StudentAI</h1>
          <p className="brand-tagline">Your smart academic companion for better grades and placement success.</p>

          <div className="brand-features">
            {[
              { icon: '📊', text: 'Track CGPA & attendance' },
              { icon: '🤖', text: 'AI-powered suggestions'  },
              { icon: '🚀', text: 'Career prep roadmaps'    },
              { icon: '🔔', text: 'Smart notifications'     },
            ].map(f => (
              <div className="brand-feature" key={f.text}>
                <span className="feature-icon">{f.icon}</span>
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
                    <span className="field-icon">{f.icon}</span>
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
                  <span className="field-icon">📅</span>
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

            <button className={`signup-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
              {loading
                ? <span className="btn-spinner" />
                : <><span>Create Account</span><span className="btn-arrow">→</span></>
              }
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
