/**
 * Clears all cached recommendations so the new scoring engine is used on next load.
 * Run: node server/scripts/clear-recommendation-cache.js
 */
const mongoose = require('mongoose');
const StudentRecommendation = require('../models/StudentRecommendation');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await StudentRecommendation.deleteMany({});
  console.log(`Cleared ${result.deletedCount} cached recommendations.`);
  await mongoose.disconnect();
}
run().catch(console.error);
