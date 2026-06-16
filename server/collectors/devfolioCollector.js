
class DevfolioCollector {
  async fetch() {
    return [
      {
        title: "Rentits Global Hackathon 2026",
        description: "Design. Build. Improve student life. Join the ultimate global, online hackathon designed for builders who prioritize real impact over hype.",
        registrationUrl: "https://hackrent.devfolio.co/",
        registrationDeadline: "2026-03-29",
        category: "Student Life",
        prizePool: 45000,
        currency: "USD",
        registeredCount: 0,
        source: "devfolio",
        sourceEventId: "hackrent-2026",
        requiredSkills: ["Web Development", "React", "Node.js", "UI/UX"],
        difficulty: "advanced",
        banner: "https://devfolio.co/images/community-hackathons-og.png"
      },
      {
        title: "CodeStorm 2026 #2",
        description: "Create Websites That Feel Alive. Online hackathon.",
        registrationUrl: "https://codestorm-week2-2026.devfolio.co/",
        registrationDeadline: "2026-06-30",
        category: "Web Development",
        prizePool: 0,
        currency: "INR",
        registeredCount: 0,
        source: "devfolio",
        sourceEventId: "codestorm-2026-week2",
        requiredSkills: ["HTML", "CSS", "JavaScript", "React"],
        difficulty: "intermediate",
        banner: "https://devfolio.co/images/community-hackathons-og.png"
      },
      {
        title: "Girlathon 4.0",
        description: "An event for them by them.",
        registrationUrl: "https://girlathon26.devfolio.co/",
        registrationDeadline: "2026-07-11",
        category: "Women in Tech",
        prizePool: 0,
        currency: "INR",
        registeredCount: 0,
        source: "devfolio",
        sourceEventId: "girlathon-4-0",
        requiredSkills: ["Python", "AI", "Machine Learning", "Web Development"],
        difficulty: "beginner",
        banner: "https://devfolio.co/images/community-hackathons-og.png"
      }
    ];
  }
}

module.exports = { DevfolioCollector };
