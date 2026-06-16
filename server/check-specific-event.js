
const mongoose = require('mongoose');
const Event = require('./models/Event');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function checkEvent() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const event = await Event.findOne({ title: { $regex: 'Battle Of Bands', $options: 'i' } });
    if (event) {
      console.log('\n=== Battle Of Bands Event ===');
      console.log('Title:', event.title);
      console.log('Banner:', event.banner);
      console.log('Is banner valid?', event.banner && event.banner.startsWith('http') && !event.banner.endsWith('_'));
      console.log('Full event:', event);
    } else {
      console.log('Event not found!');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkEvent();
