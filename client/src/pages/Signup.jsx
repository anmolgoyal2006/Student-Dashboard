import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './Signup.css';

// SVG Icons
const Icons = {
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/>
      <path d="M16 6h.01"/>
      <path d="M12 6h.01"/>
      <path d="M12 10h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 10h.01"/>
      <path d="M16 14h.01"/>
      <path d="M8 10h.01"/>
      <path d="M8 14h.01"/>
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  id: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/>
      <line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

// Feature icons
const FeatureIcons = {
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  bot: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  ),
  rocket: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    </svg>
  ),
  bell: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  ),
};

export default function Signup() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', college: '', semester: 1, branch: '', sid: '',
  });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.signup(form);
      login(data.user, data.token);
      toast.success('Account created! Welcome aboard.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Full Name', name: 'name', type: 'text', placeholder: 'Your full name', icon: Icons.user },
    { label: 'Email', name: 'email', type: 'email', placeholder: 'you@college.edu', icon: Icons.mail },
    { label: 'Password', name: 'password', type: 'password', placeholder: 'Min. 6 characters', icon: Icons.lock },
    { label: 'College', name: 'college', type: 'text', placeholder: 'Your college name', icon: Icons.building },
    { label: 'Branch', name: 'branch', type: 'text', placeholder: 'CSE / IT / ECE...', icon: Icons.code },
    { label: 'Student ID', name: 'sid', type: 'text', placeholder: 'e.g. 2201234', icon: Icons.id },
  ];

  const features = [
    { icon: FeatureIcons.chart, text: 'Track CGPA & attendance' },
    { icon: FeatureIcons.bot, text: 'AI-powered suggestions' },
    { icon: FeatureIcons.rocket, text: 'Career prep roadmaps' },
    { icon: FeatureIcons.bell, text: 'Smart notifications' },
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
          <div className="brand-logo" />
          <h1 className="brand-title">StudentAI</h1>
          <p className="brand-tagline">Your smart academic companion for better grades and placement success.</p>

          <div className="brand-features">
            {features.map(f => (
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
                  <span className="field-icon">{Icons.calendar}</span>
                  <select
                    className="field-input field-select"
                    name="semester"
                    value={form.semester}
                    onChange={handleChange}
                    onFocus={() => setFocused('semester')}
                    onBlur={() => setFocused('')}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button className={`signup-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
              {loading
                ? <span className="btn-spinner" />
                : <><span>Create Account</span><span className="btn-arrow">&#8594;</span></>
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
