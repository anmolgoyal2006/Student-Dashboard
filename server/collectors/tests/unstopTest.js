
const { testCollector } = require('../../tests/collectorTests');
const { UnstopCollector } = require('../unstopCollector');

async function testUnstop() {
  const collector = new UnstopCollector();
  return await testCollector('Unstop', () => collector.fetch());
}

// Run: node server/collectors/tests/unstopTest.js
if (require.main === module) {
  testUnstop().then(result => {
    if (result.status === "WORKING") {
      console.log("\n✅ Unstop collector is PRODUCTION READY");
      process.exit(0);
    } else {
      console.log("\n❌ Unstop collector needs fixing");
      process.exit(1);
    }
  });
}

module.exports = { testUnstop };
