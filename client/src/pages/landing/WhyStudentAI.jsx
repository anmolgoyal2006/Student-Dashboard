import { motion } from 'framer-motion';

const traditional = [
  'Multiple disconnected apps',
  'Manual grade tracking',
  'Generic study content',
  'No placement guidance',
  'No opportunity discovery',
  'Scattered notifications',
];

const studentai = [
  'One unified platform',
  'AI automation end-to-end',
  'Personalized learning paths',
  'Placement readiness scoring',
  'Hackathon discovery engine',
  'Smart deadline reminders',
];

export default function WhyStudentAI() {
  return (
    <section className="landing-section">
      <div className="landing-container">
        <h2 className="section-title">
          Why <span className="gradient-text">StudentAI?</span>
        </h2>
        <p className="section-subtitle">
          Traditional apps were built for one task. StudentAI was built for your entire academic life.
        </p>

        <motion.div
          className="why-grid"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Bad column */}
          <div className="why-col why-col-bad">
            <div className="why-col-header">Traditional Apps ❌</div>
            {traditional.map((item) => (
              <div className="why-row" key={item}>
                <span className="why-icon">✗</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Good column */}
          <div className="why-col why-col-good">
            <div className="why-col-header">StudentAI ✅</div>
            {studentai.map((item) => (
              <div className="why-row" key={item}>
                <span className="why-icon">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
