import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, ExternalLink } from 'lucide-react';

export default function Demo() {
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
            The platform is live and free to try. Sign up, connect Google Classroom,
            and get a personalized academic overview in under a minute.
          </p>

          <div className="demo-ctas">
            <Link to="/login" className="btn-primary">
              <ExternalLink size={16} /> Live Demo
            </Link>
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
