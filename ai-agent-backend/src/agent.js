const { GoogleGenerativeAI } = require('@googleapis/generativeai');
const { saveStagingBusiness, markStagingBusinessDuplicate, promoteStagingToBusiness, checkExistingBusinesses, createJob, updateJobStatus, getRunningJobs } = require('./database');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function normalizeBusinessName(name) {
  if (!name) return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u0600-\u06FF]/g, '') // Keep Arabic characters and basic alphanumerics
    .toLowerCase();
}

function validateBusinessSchema(business) {
  if (!business.name || typeof business.name !== 'string' || business.name.trim().length < 2) {
    throw new Error(`Invalid business name: ${business.name}`);
  }
  
  if (!business.category || typeof business.category !== 'string' || business.category.trim().length < 2) {
    throw new Error(`Invalid business category: ${business.category}`);
  }
  
  if (!business.city || typeof business.city !== 'string' || business.city.trim().length < 2) {
    throw new Error(`Invalid business city: ${business.city}`);
  }
  
  // Phone is optional but must be valid if present
  if (business.phone && (typeof business.phone !== 'string' || business.phone.trim().length < 5)) {
    throw new Error(`Invalid business phone: ${business.phone}`);
  }
  
  return true;
}

function calculateConfidence(business) {
  let score = 0.5; // Base score
  
  // Name is required and has high weight
  if (business.name && business.name.length > 2) score += 0.3;
  
  // Phone number adds confidence
  if (business.phone && business.phone.length > 5) score += 0.2;
  
  // City matches governorate adds confidence
  if (business.city && business.city.toLowerCase().includes(business.governorate.toLowerCase())) {
    score += 0.1;
  }
  
  // Category match adds confidence
  if (business.category && business.category.toLowerCase().includes(business.requestedCategory.toLowerCase())) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

async function searchBusinessesWithAI(governorate, category) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `You are a business data extractor. Search for businesses in the category "${category}" in ${governorate}, Iraq.
    
CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no text.

Required format:
[
  {
    "name": "Business Name",
    "category": "Business Category", 
    "city": "City Name",
    "phone": "Phone Number or null"
  }
]

Requirements:
- Each business MUST have name, category, city
- Phone can be null or valid phone number
- Maximum 30 businesses
- Real businesses if possible
- Iraqi phone format preferred
- ${governorate} location focus
- ${category} category focus

NO MARKDOWN. NO EXPLANATIONS. ONLY JSON ARRAY.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Strict JSON parsing - no markdown allowed
    let businesses;
    try {
      businesses = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON if there's any wrapper text
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in AI response');
      }
      businesses = JSON.parse(jsonMatch[0]);
    }
    
    // Validate it's an array
    if (!Array.isArray(businesses)) {
      throw new Error('AI response is not an array');
    }
    
    // Validate each business object
    const validBusinesses = [];
    for (const business of businesses) {
      try {
        validateBusinessSchema(business);
        validBusinesses.push(business);
      } catch (validationError) {
        console.warn('Skipping invalid business:', validationError.message);
        continue;
      }
    }
    
    // Limit to 30 businesses
    return validBusinesses.slice(0, 30);
    
  } catch (error) {
    console.error('AI search error:', error);
    throw new Error(`AI search failed: ${error.message}`);
  }
}

function cleanAndValidateBusinesses(businesses, governorate, category) {
  const cleaned = [];
  const seen = new Set();
  
  for (const business of businesses) {
    // Normalize name for duplicate detection
    const normalizedName = normalizeBusinessName(business.name);
    
    // Skip if no name or duplicate
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }
    
    seen.add(normalizedName);
    
    // Clean and validate the business
    const cleanedBusiness = {
      name: business.name || '',
      category: business.category || category,
      city: business.city || governorate,
      phone: business.phone || '',
      governorate: governorate,
      requestedCategory: category,
      confidence: 0
    };
    
    // Calculate confidence score
    cleanedBusiness.confidence = calculateConfidence(cleanedBusiness);
    
    // Only include businesses with minimum confidence
    if (cleanedBusiness.confidence >= 0.3) {
      cleaned.push(cleanedBusiness);
    }
  }
  
  return cleaned;
}

async function runAgent(governorate, category) {
  let job;
  
  try {
    // Step 0: Create job for tracking
    console.log(`📋 Creating job for ${category} in ${governorate}`);
    job = await createJob(governorate, category);
    
    // Update status to running
    await updateJobStatus(job.id, 'running', 10);
    console.log(`🤖 Starting agent: ${category} in ${governorate} (Job: ${job.id})`);
    
    // Step 1: Search for businesses using AI
    console.log('🔍 Searching businesses with AI...');
    await updateJobStatus(job.id, 'running', 30);
    const rawBusinesses = await searchBusinessesWithAI(governorate, category);
    console.log(`Found ${rawBusinesses.length} raw business results`);
    
    // Step 2: Clean and validate data
    console.log('🧹 Cleaning and validating data...');
    await updateJobStatus(job.id, 'running', 50, rawBusinesses.length);
    const cleanedBusinesses = cleanAndValidateBusinesses(rawBusinesses, governorate, category);
    console.log(`Cleaned to ${cleanedBusinesses.length} valid businesses`);
    
    // Step 3: Save to staging immediately and check duplicates
    console.log('� Saving to staging and checking duplicates...');
    await updateJobStatus(job.id, 'running', 70);
    const stagingIds = [];
    const newBusinesses = [];
    
    for (const business of cleanedBusinesses) {
      try {
        // Save to staging immediately
        const staging = await saveStagingBusiness(business, job.id);
        stagingIds.push(staging.id);
        
        // Check if duplicate
        const exists = await checkExistingBusinesses(business.name, business.phone);
        if (exists) {
          await markStagingBusinessDuplicate(staging.id);
          console.log(`🔄 Marked as duplicate: ${business.name}`);
        } else {
          // Promote to final businesses table
          const finalBusiness = await promoteStagingToBusiness(staging.id);
          newBusinesses.push(finalBusiness);
          console.log(`✅ Saved new business: ${business.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process business ${business.name}:`, error.message);
        continue;
      }
    }
    
    // Step 4: Final job completion
    await updateJobStatus(job.id, 'running', 90, rawBusinesses.length, newBusinesses.length);
    
    if (newBusinesses.length > 0) {
      console.log(`✅ Agent completed: ${newBusinesses.length} new businesses saved`);
      await updateJobStatus(job.id, 'done', 100, rawBusinesses.length, newBusinesses.length);
      return newBusinesses;
    } else {
      console.log('ℹ️ No new businesses to save');
      await updateJobStatus(job.id, 'done', 100, rawBusinesses.length, 0);
      return [];
    }
    
  } catch (error) {
    console.error('❌ Agent execution failed:', error);
    
    // Mark job as failed if we have one
    if (job) {
      await updateJobStatus(job.id, 'failed', null, null, null, error.message);
    }
    
    throw error;
  }
}

// Resume interrupted jobs on server startup
async function resumeInterruptedJobs() {
  try {
    console.log('🔄 Checking for interrupted jobs...');
    const runningJobs = await getRunningJobs();
    
    if (runningJobs.length === 0) {
      console.log('✅ No interrupted jobs found');
      return;
    }
    
    console.log(`Found ${runningJobs.length} interrupted jobs, resuming...`);
    
    for (const job of runningJobs) {
      try {
        console.log(`🔄 Resuming job: ${job.governorate} - ${job.category}`);
        await runAgent(job.governorate, job.category);
      } catch (error) {
        console.error(`❌ Failed to resume job ${job.id}:`, error.message);
      }
    }
    
    console.log('✅ Job resumption completed');
  } catch (error) {
    console.error('❌ Job resumption failed:', error);
  }
}

module.exports = { 
  runAgent, 
  resumeInterruptedJobs 
};
