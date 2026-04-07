const { runAgent } = require('./agent');

// Iraq governorates for auto-continue
const GOVERNORATES = [
  'Baghdad', 'Basra', 'Najaf', 'Karbala', 'Erbil', 'Duhok', 'Sulaymaniyah',
  'Mosul', 'Kirkuk', 'Dhi Qar', 'Maysan', 'Muthanna', 'Al Anbar', 'Babil',
  'Diyala', 'Wasit', 'Saladin', 'Al-Qadisiyyah'
];

// Business categories for auto-continue
const CATEGORIES = [
  'restaurants', 'hotels', 'pharmacies', 'supermarkets', 'gas stations',
  'hospitals', 'schools', 'banks', 'clothing stores', 'electronics stores',
  'car repair', 'beauty salons', 'cafes', 'bakeries', 'bookstores'
];

async function runAutoContinue(governorate, startCategory = null) {
  console.log(`🚀 Starting auto-continue for ${governorate}`);
  
  const categoriesToRun = startCategory 
    ? CATEGORIES.slice(CATEGORIES.indexOf(startCategory))
    : CATEGORIES;
  
  for (const category of categoriesToRun) {
    try {
      console.log(`\n📍 ${governorate} → ${category}`);
      console.log('=' .repeat(50));
      
      const result = await runAgent(governorate, category);
      console.log(`✅ Completed ${category}: ${result.length} businesses saved`);
      
      // Small delay between categories to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Failed ${category}:`, error.message);
      // Continue with next category even if one fails
      continue;
    }
  }
  
  console.log(`\n🎉 Auto-continue completed for ${governorate}`);
}

async function runFullIraqCoverage() {
  console.log('🇮🇶 Starting full Iraq coverage - all governorates');
  
  for (const governorate of GOVERNORATES) {
    try {
      await runAutoContinue(governorate);
      console.log(`✅ Governorate ${governorate} completed`);
    } catch (error) {
      console.error(`❌ Governorate ${governorate} failed:`, error.message);
    }
  }
  
  console.log('\n🎉 Full Iraq coverage completed!');
}

module.exports = {
  runAutoContinue,
  runFullIraqCoverage,
  GOVERNORATES,
  CATEGORIES
};
