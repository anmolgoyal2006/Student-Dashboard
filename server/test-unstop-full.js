
const axios = require('axios');

async function testUnstopFull() {
  try {
    const baseUrl = "https://unstop.com/api/public/opportunity/search-result";
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://unstop.com/hackathons"
    };
    const params = { oppstatus: "open", per_page: 5 };
    
    const response = await axios.get(baseUrl, { params, headers });
    let opportunities = [];
    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      opportunities = response.data.data.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      opportunities = response.data.data;
    }
    
    console.log('Number of events:', opportunities.length);
    opportunities.forEach((opp, i) => {
      console.log(`\n=== Event ${i+1} ===`);
      console.log('Title:', opp.title);
      console.log('Status:', opp.status);
      console.log('Regn open:', opp.regn_open);
      console.log('End date:', opp.end_date);
      console.log('Thumb:', opp.thumb);
      console.log('LogoUrl2:', opp.logoUrl2);
      console.log('Organisation:', opp.organisation);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testUnstopFull();
