
const mongoose = require('mongoose');
const { UnstopCollector } = require('./collectors/unstopCollector');
const { DevfolioCollector } = require('./collectors/devfolioCollector');
const { saveEvents } = require('./services/eventService');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('\n--- Running Unstop Collector ---');
    const unstopCollector = new UnstopCollector();
    const unstopEvents = await unstopCollector.fetch();
    console.log(`Fetched ${unstopEvents.length} Unstop events`);
    await saveEvents(unstopEvents);

    console.log('\n--- Running Devfolio Collector ---');
    const devfolioCollector = new DevfolioCollector();
    const devfolioEvents = await devfolioCollector.fetch();
    console.log(`Fetched ${devfolioEvents.length} Devfolio events`);
    await saveEvents(devfolioEvents);

    console.log('\n--- Done ---');
    process.exit(0);
  } catch (error) {
    console.error('Error running collector:', error);
    process.exit(1);
  }
}

run();
