/**
 * Migration: replace blocked/null devfolio banners with category-based Unsplash images
 * Run: node server/scripts/fix-devfolio-banners.js
 */

const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const CATEGORY_BANNERS = {
  'Technology':     'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80',
  'AI/ML':          'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80',
  'Student':        'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80',
  'Student Life':   'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80',
  'Web Development':'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=600&q=80',
  'Mobile':         'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80',
  'Design':         'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80',
  'Blockchain':     'https://images.unsplash.com/photo-1639762681057-408e52192e55?w=600&q=80',
  'Gaming':         'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
  'Women in Tech':  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&q=80',
  'Social Impact':  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=600&q=80',
  'FinTech':        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
  'HealthTech':     'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80',
  'Open Innovation':'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
  '_default':       'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
};

// Domains known to block cross-origin image embedding
const BLOCKED_DOMAINS = ['devfolio.co'];

const isBlockedBanner = (url) => {
  if (!url) return true;
  return BLOCKED_DOMAINS.some(domain => url.includes(domain));
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find devfolio events with null, empty, or blocked banners
  const events = await Event.find({ source: 'devfolio' });
  const toFix = events.filter(e => !e.banner || isBlockedBanner(e.banner));
  console.log(`Found ${toFix.length} devfolio events needing banner fix`);

  let updated = 0;
  for (const event of toFix) {
    const banner = CATEGORY_BANNERS[event.category] || CATEGORY_BANNERS['_default'];
    await Event.updateOne({ _id: event._id }, { $set: { banner } });
    console.log(`  ✓ ${event.title} (${event.category}) → ${banner}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} events.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
