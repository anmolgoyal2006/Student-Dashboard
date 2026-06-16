
const axios = require('axios');

async function debugUnstop() {
  try {
    const baseUrl = "https://unstop.com/api/public/opportunity/search-result";
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://unstop.com/hackathons"
    };
    const params = { oppstatus: "open", per_page: 1 };
    
    const response = await axios.get(baseUrl, { params, headers });
    let opportunities = [];
    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      opportunities = response.data.data.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      opportunities = response.data.data;
    }
    
    if (opportunities.length > 0) {
      console.log("=== Sample Unstop Event ===");
      console.log("Title:", opportunities[0].title);
      console.log("\nAll fields available:");
      console.log(Object.keys(opportunities[0]));
      
      // Log image-related fields
      console.log("\nImage fields:");
      console.log("- thumb:", opportunities[0].thumb);
      console.log("- logoUrl2:", opportunities[0].logoUrl2);
      console.log("- image:", opportunities[0].image);
      console.log("- organisation (if exists):", opportunities[0].organisation ? Object.keys(opportunities[0].organisation) : 'not present');
      if (opportunities[0].organisation) {
        console.log("  - organisation.logoUrl:", opportunities[0].organisation.logoUrl);
        console.log("  - organisation.logoUrl2:", opportunities[0].organisation.logoUrl2);
      }
      
      // Log full event
      console.log("\nFull event object:");
      console.log(JSON.stringify(opportunities[0], null, 2));
    } else {
      console.log("No events found!");
    }
  } catch (err) {
    console.error("Error fetching from Unstop:", err);
  }
}

debugUnstop();
