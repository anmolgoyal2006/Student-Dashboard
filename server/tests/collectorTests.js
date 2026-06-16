
async function testCollector(name, collectorFn) {
  console.log(`\n🧪 Testing ${name}...`);
  
  try {
    const result = await collectorFn();
    
    if (!result || result.length === 0) {
      console.log(`❌ ${name}: NO DATA RETURNED`);
      return { status: "FAILED", reason: "empty_result" };
    }
    
    // Verify schema
    const sample = result[0];
    const requiredFields = [
      'title', 'description', 'registrationUrl',
      'registrationDeadline', 'category'
    ];
    
    const missing = requiredFields.filter(f => !sample[f]);
    if (missing.length > 0) {
      console.log(`❌ ${name}: Missing fields - ${missing.join(', ')}`);
      return { status: "FAILED", reason: "missing_fields", fields: missing };
    }
    
    console.log(`✅ ${name}: WORKING`);
    console.log(`   📊 Found ${result.length} events`);
    console.log(`   🏆 Sample: "${sample.title}"`);
    console.log(`   💰 Prize: ${sample.prizePool} ${sample.currency}`);
    console.log(`   📅 Deadline: ${sample.registrationDeadline}`);
    
    return {
      status: "WORKING",
      eventCount: result.length,
      sample: sample
    };
  } catch (error) {
    console.log(`❌ ${name}: ERROR`);
    console.log(`   Error: ${error.message}`);
    return { status: "ERROR", error: error.message };
  }
}

module.exports = { testCollector };
