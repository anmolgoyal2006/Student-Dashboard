
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
      const params = { oppstatus: "open", per_page: 50 };
      const response = await axios.get(this.baseUrl, { params, headers: this.headers });
      
      let opportunities = [];
      if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        opportunities = response.data.data.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        opportunities = response.data.data;
      }

      // Filter only live/active events
      const validOpportunities = opportunities.filter(opp => {
        if (opp.status !== 'LIVE') return false;
        if (opp.regn_open !== 1) return false;
        if (opp.regnRequirements?.end_regn_dt) {
          const regDeadline = new Date(opp.regnRequirements.end_regn_dt);
          if (regDeadline < new Date()) return false;
        }
        return true;
      });

      console.log(`Filtered ${opportunities.length} events down to ${validOpportunities.length} valid events`);

      if (validOpportunities.length > 0) {
        const sample = validOpportunities[0];
        console.log('Sample event fields:', Object.keys(sample));
        console.log('Sample logoUrl2:', sample.logoUrl2);
        console.log('Sample organisation:', sample.organisation);
      }

      return validOpportunities.map(opp => {
        // Parse registration deadline
        let regDeadline = null;
        if (opp.regnRequirements?.end_regn_dt) {
          regDeadline = new Date(opp.regnRequirements.end_regn_dt).toISOString().split('T')[0];
        }

        // Parse prize details
        let prize = 0;
        let currency = 'INR';
        if (opp.prizes && opp.prizes.length > 0 && opp.prizes[0].amount) {
          prize = opp.prizes[0].amount;
          currency = opp.prizes[0].currency || 'INR';
        }

        // Get SEO URL
        const registrationUrl = opp.seo_url || 'https://unstop.com/hackathons';

        // Get description
        const description = stripHtml(opp.details || '');

        // Get category
        const category = opp.type || opp.subtype || 'Hackathon';

        // Extract required skills
        const requiredSkills = [];
        const skillKeywords = ['python', 'java', 'javascript', 'react', 'node', 'nodejs', 'ai', 'ml', 'machine learning', 'deep learning', 'data science', 'web development', 'flutter', 'android', 'ios', 'blockchain', 'iot', 'cloud', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'docker', 'kubernetes', 'git', 'github', 'typescript', 'nextjs', 'vue', 'angular', 'css', 'html', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'r', 'scala', 'matlab'];
        
        if (opp.tags && Array.isArray(opp.tags)) {
          opp.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            if (skillKeywords.includes(tagLower) && !requiredSkills.includes(tag)) {
              requiredSkills.push(tag);
            }
          });
        }
        
        if (opp.required_skills && Array.isArray(opp.required_skills)) {
          opp.required_skills.forEach(skill => {
            const skillStr = typeof skill === 'string' ? skill : skill.name || '';
            if (skillStr && !requiredSkills.includes(skillStr)) {
              requiredSkills.push(skillStr);
            }
          });
        }

        // Determine difficulty
        let difficulty = 'intermediate';
        if (prize > 100000) {
          difficulty = 'advanced';
        } else if (prize === 0 && category.toLowerCase().includes('beginner')) {
          difficulty = 'beginner';
        }

        // Extract banner image - try all possible fields and only use valid ones
        let banner = null;
        
        // Helper to check if URL is valid
        const isValidImageUrl = (url) => {
          if (!url || !url.startsWith('http')) return false;
          if (url.endsWith('_')) return false; // Skip URLs ending with underscore
          return true;
        };
        
        if (isValidImageUrl(opp.logoUrl2)) {
          banner = opp.logoUrl2;
        } else if (isValidImageUrl(opp.organisation?.logoUrl)) {
          banner = opp.organisation.logoUrl;
        } else if (isValidImageUrl(opp.organisation?.logoUrl2)) {
          banner = opp.organisation.logoUrl2;
        } else if (isValidImageUrl(opp.thumb)) {
          banner = opp.thumb;
        }

        if (validOpportunities.indexOf(opp) === 0) {
          console.log('First event banner:', banner);
        }

        return {
          title: opp.title || 'Untitled Event',
          description: description,
          registrationUrl: registrationUrl,
          registrationDeadline: regDeadline,
          category: category,
          prizePool: prize,
          currency: currency,
          registeredCount: opp.registerCount || 0,
          source: "unstop",
          sourceEventId: opp.id?.toString(),
          requiredSkills: requiredSkills,
          difficulty: difficulty,
          banner: banner
        };
      });
    } catch (error) {
      console.error("Error fetching Unstop data:", error.message);
      return [];
    }
  }
}

module.exports = { UnstopCollector };
