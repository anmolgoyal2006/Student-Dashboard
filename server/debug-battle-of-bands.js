
const axios = require('axios');

async function debugBattleOfBands() {
  try {
    const baseUrl = "https://unstop.com/api/public/opportunity/search-result";
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://unstop.com/hackathons"
    };
    const params = { oppstatus: "open", per_page: 50 };
    
    const response = await axios.get(baseUrl, { params, headers });
    
    let opportunities = [];
    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      opportunities = response.data.data.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      opportunities = response.data.data;
    }

    const battle = opportunities.find(o => o.title.toLowerCase().includes('battle of bands'));
    if (battle) {
      console.log('=== RAW BATTLE OF BANDS EVENT ===');
      console.log(JSON.stringify(battle, null, 2));
    } else {
      console.log('Battle of Bands not found!');
      console.log('All event titles:', opportunities.map(o => o.title));
    }
  } catch (err) {
    console.error(err);
  }
}

debugBattleOfBands();
