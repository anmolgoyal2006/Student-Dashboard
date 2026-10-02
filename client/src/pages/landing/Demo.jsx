import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, PlayCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/apiServices';
import toast from '../../context/ToastContext';

const DEMO_CREDENTIALS = { email: 'demo@studentai.app', password: 'Demo@123' };

export default function Demo() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleViewDemo = async () => {
    setDemoLoading(true);
    try {
      const { data } = await authService.login(DEMO_CREDENTIALS);
      login(data.user, data.token);
      toast.success('Welcome to the StudentAI demo!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Demo login failed — please try again shortly.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <section className="demo-section">
      <div className="demo-glow" />
      <div className="landing-container" style={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div className="demo-badge">
              <span className="demo-badge-dot" />
              Production Deployed
            </div>
          </div>

          <h2 className="section-title">
            See <span className="gradient-text">StudentAI</span> in action
          </h2>
          <p className="section-subtitle">
            The platform is live and free to try. Jump straight into a demo account preloaded
            with real semesters, attendance history, and DSA progress — no signup required.
          </p>

          <div className="demo-ctas">
            <button
              type="button"
              onClick={handleViewDemo}
              disabled={demoLoading}
              className="btn-primary"
            >
              <PlayCircle size={16} /> {demoLoading ? 'Loading demo…' : 'View Demo'}
            </button>
            <a
              href="https://github.com/anmolgoyal2006/Student-Dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              <GitBranch size={16} /> View on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
