
const { testUnstop } = require('../collectors/tests/unstopTest');
const { testDevfolio } = require('../collectors/tests/devfolioTest');

async function runAllTests() {
  console.log("\n🧪 COLLECTOR VERIFICATION SUITE");
  console.log("================================\n");
  
  const results = {
    working: [],
    failed: [],
    error: []
  };
  
  // Test each collector
  const unstopResult = await testUnstop();
  const devfolioResult = await testDevfolio();
  
  // Categorize results
  const collectors = [
    { name: 'Unstop', result: unstopResult },
    { name: 'Devfolio', result: devfolioResult }
  ];
  
  collectors.forEach(({ name, result }) => {
    if (result.status === 'WORKING') {
      results.working.push(name);
    } else if (result.status === 'FAILED') {
      results.failed.push(name);
    } else {
      results.error.push(name);
    }
  });
  
  // Print summary
  console.log("\n📊 SUMMARY");
  console.log("==========");
  console.log(`✅ Working: ${results.working.length} (${results.working.join(', ')})`);
  console.log(`⚠️  Failed: ${results.failed.length}`);
  console.log(`❌ Error: ${results.error.length}`);
  
  if (results.error.length === 0 && results.failed.length === 0) {
    console.log("\n✅ ALL COLLECTORS VERIFIED - READY FOR PRODUCTION");
    return true;
  } else {
    console.log("\n❌ FIX FAILING COLLECTORS BEFORE DEPLOYING");
    return false;
  }
}

runAllTests().then(success => process.exit(success ? 0 : 1));
