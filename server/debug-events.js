
const mongoose = require('mongoose');
const Event = require('./models/Event');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the first 3 events
    const events = await Event.find().limit(3);
    console.log('\nSample events:');
    events.forEach((e, i) => {
      console.log(`\nEvent ${i+1}:`);
      console.log('Title:', e.title);
      console.log('Description:', e.description ? (e.description.length > 150 ? e.description.slice(0,150) + '...' : e.description) : 'No description');
      console.log('Registration URL:', e.registrationUrl);
      console.log('Banner:', e.banner);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
