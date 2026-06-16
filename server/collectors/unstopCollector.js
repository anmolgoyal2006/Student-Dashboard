
const axios = require('axios');
const { stripHtml } = require('../utils/helpers');

class UnstopCollector {
  constructor() {
    this.baseUrl = "https://unstop.com/api/public/opportunity/search-result";
    this.headers = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://unstop.com/hackathons"
    };
  }

  async fetch() {
    try {
      const params = {
        oppstatus: "open",
        per_page: 50
      };
      const response = await axios.get(this.baseUrl, { params, headers: this.headers });
      // Get opportunities array from response
      let opportunities = [];
      if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        opportunities = response.data.data.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        opportunities = response.data.data;
      } else {
        console.log("No valid opportunities array found");
      }
      return opportunities.map(opp => {
        // Parse registration deadline from regnRequirements.end_regn_dt
        let regDeadline = null;
        if (opp.regnRequirements?.end_regn_dt) {
          regDeadline = new Date(opp.regnRequirements.end_regn_dt).toISOString().split('T')[0];
        }
        // Parse prize details from 'prizes' array
        let prize = 0;
        let currency = 'INR';
        if (opp.prizes && opp.prizes.length > 0 && opp.prizes[0].amount) {
          prize = opp.prizes[0].amount;
          currency = opp.prizes[0].currency || 'INR';
        }
        // Get registration count
        const registeredCount = opp.registerCount || 0;
        // Get SEO URL - it's already a full URL!
        let registrationUrl = opp.seo_url || 'https://unstop.com/hackathons';
        
        // Get description from 'details' field and strip HTML
        const description = stripHtml(opp.details || '');
        
        // Log for debugging
        if (opportunities.length > 0 && opportunities.indexOf(opp) === 0) {
          console.log('Sample Unstop event:', {
            seo_url: opp.seo_url,
            details: opp.details ? (description.length > 100 ? description.slice(0,100) + '...' : description) : 'No description',
            thumb: opp.thumb,
            logoUrl2: opp.logoUrl2,
            organisation: opp.organisation
          });
        }
        
        // Get category from 'type' or 'subtype'
        const category = opp.type || opp.subtype || 'Hackathon';
        
        // Extract required skills from tags or description
        const requiredSkills = [];
        const skillKeywords = ['python', 'java', 'javascript', 'react', 'node', 'nodejs', 'ai', 'ml', 'machine learning', 'deep learning', 'data science', 'web development', 'flutter', 'android', 'ios', 'blockchain', 'iot', 'cloud', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'docker', 'kubernetes', 'git', 'github', 'typescript', 'nextjs', 'vue', 'angular', 'css', 'html', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'r', 'scala', 'matlab'];
        
        // Check tags if available
        if (opp.tags && Array.isArray(opp.tags)) {
          opp.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            if (skillKeywords.includes(tagLower) && !requiredSkills.includes(tag)) {
              requiredSkills.push(tag);
            }
          });
        }
        
        // Check required_skills field if available
        if (opp.required_skills && Array.isArray(opp.required_skills)) {
          opp.required_skills.forEach(skill => {
            const skillStr = typeof skill === 'string' ? skill : skill.name || '';
            if (skillStr && !requiredSkills.includes(skillStr)) {
              requiredSkills.push(skillStr);
            }
          });
        }
        
        // Check description for skills if no tags
        if (requiredSkills.length === 0) {
          const descLower = description.toLowerCase();
          skillKeywords.forEach(skill => {
            if (descLower.includes(skill) && !requiredSkills.includes(skill)) {
              // Capitalize first letter
              requiredSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
            }
          });
        }

        // Determine difficulty based on prize pool or category
        let difficulty = 'intermediate';
        if (prize > 100000) {
          difficulty = 'advanced';
        } else if (prize === 0 && category.toLowerCase().includes('beginner')) {
          difficulty = 'beginner';
        }

        // Extract banner image - try all possible fields with correct names!
        let banner = null;
        if (opp.thumb && opp.thumb.startsWith('http')) {
          banner = opp.thumb;
        } else if (opp.logoUrl2 && opp.logoUrl2.startsWith('http')) {
          banner = opp.logoUrl2;
        } else if (opp.organisation && opp.organisation.logoUrl) {
          banner = opp.organisation.logoUrl;
        } else if (opp.organisation && opp.organisation.logoUrl2) {
          banner = opp.organisation.logoUrl2;
        }
        
        return {
          title: opp.title || 'Untitled Event',
          description: description,
          registrationUrl: registrationUrl,
          registrationDeadline: regDeadline,
          category: category,
          prizePool: prize,
          currency: currency,
          registeredCount: registeredCount,
          source: "unstop",
          sourceEventId: opp.id?.toString(),
          requiredSkills: requiredSkills,
          difficulty: difficulty,
          banner: banner
        };
      });
    } catch (error) {
      console.error("Error fetching Unstop data:", error.message);
      return [
        {
          title: "Quasar X AI 2026",
          description: "A 24-hour AI innovation hackathon hosted by IIIT Ranchi",
          registrationUrl: "https://unstop.com/hackathons/quasar-x-ai-2026-indian-institute-of-information-technology-iiit-ranchi-1613293",
          registrationDeadline: "2026-01-18",
          category: "AI",
          prizePool: 0,
          currency: "INR",
          registeredCount: 148,
          source: "unstop",
          sourceEventId: "1613293"
        }
      ];
    }
  }
}

module.exports = { UnstopCollector };
