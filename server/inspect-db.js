
const mongoose = require('mongoose');
const Event = require('./models/Event');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function inspectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all events sorted by date
    const events = await Event.find().sort({ registrationDeadline: -1 });
    console.log(`\nTotal events in DB: ${events.length}`);

    events.forEach((e, i) => {
      console.log(`\nEvent ${i + 1}`);
      console.log(`  Title: ${e.title}`);
      console.log(`  Source: ${e.source}`);
      console.log(`  Deadline: ${e.registrationDeadline}`);
      console.log(`  Banner: ${e.banner}`);
      console.log(`  Description: ${e.description ? 'Yes' : 'No'}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectDB();
