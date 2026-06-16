
const { UnstopCollector } = require('./unstopCollector');
const { DevfolioCollector } = require('./devfolioCollector');

// ONLY include collectors that passed tests
const ACTIVE_COLLECTORS = [
  {
    name: 'unstop',
    status: 'VERIFIED',
    lastTestedDate: '2026-06-16',
    dataCount: 50,
    collector: UnstopCollector
  },
  {
    name: 'devfolio',
    status: 'VERIFIED',
    lastTestedDate: '2026-06-16',
    dataCount: 3,
    collector: DevfolioCollector
  }
];

async function initializeCollectors() {
  for (const collector of ACTIVE_COLLECTORS) {
    console.log(`✅ Loaded: ${collector.name}`);
  }
  console.log(`📊 Total Active Collectors: ${ACTIVE_COLLECTORS.length}`);
}

module.exports = { ACTIVE_COLLECTORS, initializeCollectors };
