
const axios = require('axios');
const { stripHtml } = require('./utils/helpers');

async function testUnstop() {
  try {
    console.log('Testing Unstop API...');
    const baseUrl = "https://unstop.com/api/public/opportunity/search-result";
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://unstop.com/hackathons"
    };
    const params = { oppstatus: "open", per_page: 3 };
    
    const response = await axios.get(baseUrl, { params, headers });
    console.log('Response status:', response.status);
    let opportunities = [];
    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      opportunities = response.data.data.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      opportunities = response.data.data;
    }
    console.log('Number of events found:', opportunities.length);
    if (opportunities.length > 0) {
      const opp = opportunities[0];
      console.log('\nFirst event keys:', Object.keys(opp));
      console.log('First event title:', opp.title);
      console.log('First event seo_url:', opp.seo_url);
      console.log('First event details:', opp.details ? (opp.details.length > 200 ? opp.details.slice(0, 200) + '...' : opp.details) : 'No details');
      console.log('First event curatedImage:', opp.curatedImage);
      console.log('First event logoUrl:', opp.logoUrl);
      console.log('First event organization:', opp.organization);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testUnstop();
