import { motion } from 'framer-motion';

const techItems = [
  { emoji: '⚛️',  name: 'React' },
  { emoji: '🟢',  name: 'Node.js' },
  { emoji: '🚂',  name: 'Express' },
  { emoji: '🍃',  name: 'MongoDB' },
  { emoji: '🔑',  name: 'JWT' },
  { emoji: '🔐',  name: 'Google OAuth' },
  { emoji: '🔥',  name: 'Firebase' },
  { emoji: '✨',  name: 'Gemini AI' },
  { emoji: '📊',  name: 'Chart.js' },
  { emoji: '🎓',  name: 'Classroom API' },
  { emoji: '📄',  name: 'pdfplumber' },
  { emoji: '📱',  name: 'PWA + FCM' },
];

export default function TechStack() {
  return (
    <section
      className="landing-section"
      id="tech-stack"
      style={{ background: 'rgba(99,102,241,0.02)' }}
    >
      <div className="landing-container">
        <h2 className="section-title">
          Built with <span className="gradient-text">production-grade</span> tech
        </h2>
        <p className="section-subtitle">
          Every component chosen for reliability, performance, and developer ergonomics.
        </p>

        <div className="techstack-grid">
          {techItems.map((tech, i) => (
            <motion.div
              key={tech.name}
              className="tech-card liquid-glass"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <span className="tech-emoji">{tech.emoji}</span>
              <span className="tech-name">{tech.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
