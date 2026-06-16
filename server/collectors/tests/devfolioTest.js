
const { testCollector } = require('../../tests/collectorTests');
const { DevfolioCollector } = require('../devfolioCollector');

async function testDevfolio() {
  const collector = new DevfolioCollector();
  return await testCollector('Devfolio', () => collector.fetch());
}

// Run: node server/collectors/tests/devfolioTest.js
if (require.main === module) {
  testDevfolio().then(result => {
    if (result.status === "WORKING") {
      console.log("\n✅ Devfolio collector is PRODUCTION READY");
      process.exit(0);
    } else {
      console.log("\n❌ Devfolio collector needs fixing");
      process.exit(1);
    }
  });
}

module.exports = { testDevfolio };
