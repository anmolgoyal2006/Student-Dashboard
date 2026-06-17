const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await Notification.countDocuments();
  console.log('Total notifications in DB:', total);
  const recent = await Notification.find().sort({ createdAt: -1 }).limit(10).lean();
  recent.forEach(n => console.log(new Date(n.createdAt).toLocaleDateString(), '|', n.type, '|', n.title));
  await mongoose.disconnect();
}
run().catch(console.error);
