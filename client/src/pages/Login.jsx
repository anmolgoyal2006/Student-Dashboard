import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import toast from 'react-hot-toast';
import './Login.css';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.login(form);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Email',    name: 'email',    type: 'email',    placeholder: 'you@college.edu',   icon: '✉️' },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••',           icon: '🔒' },
  ];

  return (
    <div className="login-page">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="grid-overlay" />

      <div className="login-wrapper">
        {/* Left panel */}
        <div className="login-brand">
          <div className="brand-logo">🎓</div>
          <h1 className="brand-title">StudentAI</h1>
          <p className="brand-tagline">Smart academics. Better career. All in one place.</p>

          <div className="login-stats">
            {[
              { value: '10K+', label: 'Students' },
              { value: '95%',  label: 'Satisfaction' },
              { value: '4.9★', label: 'Rating' },
            ].map(s => (
              <div className="stat-pill" key={s.label}>
                <div className="stat-val">{s.value}</div>
                <div className="stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="testimonial">
            <p>"StudentAI helped me track my attendance and get placed at Amazon. Best tool for engineers!"</p>
            <div className="testimonial-author">— Priya S., CSE Final Year</div>
          </div>
        </div>

        {/* Right form */}
        <div className="login-form-panel">
          <div className="login-form-header">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to continue your journey</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {fields.map(f => (
              <div className={`login-field ${focused === f.name ? 'field-focused' : ''}`} key={f.name}>
                <label className="login-label">{f.label}</label>
                <div className="login-input-wrap">
                  <span className="login-icon">{f.icon}</span>
                  <input
                    className="login-input"
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

            <button className={`login-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
              {loading
                ? <span className="btn-spinner" />
                : <><span>Sign In</span><span className="btn-arrow">→</span></>
              }
            </button>
          </form>

          <p className="login-footer">
            No account?{' '}
            <Link to="/signup" className="login-anchor">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
