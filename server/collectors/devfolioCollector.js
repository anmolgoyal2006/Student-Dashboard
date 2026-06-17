
const { stripHtml } = require('../utils/helpers');

/**
 * Devfolio Hackathon Collector
 * 
 * NOTE: Devfolio does NOT provide a public API for fetching hackathons.
 * This collector currently uses placeholder data for demonstration purposes.
 * 
 * Possible enhancements:
 * - Web scraping (check Devfolio's robots.txt and Terms of Service first)
 * - Manual curation
 * - Integration with Devfolio's partner program if available
 */
class DevfolioCollector {
  constructor() {
    this.baseUrl = 'https://devfolio.co';
  }

  /**
   * Fetch hackathons from Devfolio
   * @returns {Array} Array of hackathon events
   */
  async fetch() {
    // Since Devfolio has no public API, we return placeholder events
    // In production, you would implement web scraping or another method here
    
    // Placeholder events - these are for demonstration only
    return [
      {
        title: "Global Tech Hackathon 2025",
        description: "Build innovative solutions for real-world problems. Open to all developers worldwide.",
        registrationUrl: "https://devfolio.co/hackathons",
        registrationDeadline: this.getFutureDate(30),
        category: "Technology",
        prizePool: 10000,
        currency: "USD",
        registeredCount: 250,
        source: "devfolio",
        sourceEventId: "global-tech-2025",
        requiredSkills: ["Web Development", "Mobile Development", "AI/ML"],
        difficulty: "intermediate",
        banner: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80"
      },
      {
        title: "Student Innovation Challenge",
        description: "Exclusive hackathon for students to showcase their creativity and technical skills.",
        registrationUrl: "https://devfolio.co/hackathons",
        registrationDeadline: this.getFutureDate(45),
        category: "Student",
        prizePool: 5000,
        currency: "USD",
        registeredCount: 180,
        source: "devfolio",
        sourceEventId: "student-innovation-2025",
        requiredSkills: ["Python", "JavaScript", "UI/UX Design"],
        difficulty: "beginner",
        banner: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80"
      },
      {
        title: "AI & ML Summit Hack",
        description: "Dive deep into artificial intelligence and machine learning with this specialized hackathon.",
        registrationUrl: "https://devfolio.co/hackathons",
        registrationDeadline: this.getFutureDate(60),
        category: "AI/ML",
        prizePool: 15000,
        currency: "USD",
        registeredCount: 320,
        source: "devfolio",
        sourceEventId: "ai-ml-summit-2025",
        requiredSkills: ["Python", "TensorFlow", "PyTorch", "Data Science"],
        difficulty: "advanced",
        banner: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80"
      }
    ];
  }

  /**
   * Helper function to get a future date
   * @param {number} daysFromNow - Number of days from today
   * @returns {string} ISO date string
   */
  getFutureDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }
}

module.exports = { DevfolioCollector };
