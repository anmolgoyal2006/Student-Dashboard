const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const r = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
  console.log(`Deleted ${r.deletedCount} old notifications (older than 7 days)`);
  await mongoose.disconnect();
}
run().catch(console.error);
