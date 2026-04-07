const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Column mapping configurations for different Excel formats
const columnMappings = {
  // Standard mapping - adjust based on your Excel headers
  standard: {
    name: ['name', 'business_name', 'company_name', 'title', 'business'],
    category: ['category', 'business_type', 'type', 'classification'],
    city: ['city', 'location', 'town', 'area'],
    phone: ['phone', 'telephone', 'mobile', 'contact', 'number'],
    governorate: ['governorate', 'province', 'state', 'region']
  },
  // Alternative mapping for different header variations
  alternative: {
    name: ['اسم', 'الاسم', 'اسم الشركة', 'اسم المنشأة'],
    category: ['فئة', 'تصنيف', 'نوع النشاط', 'نشاط'],
    city: ['مدينة', 'الموقع', 'المنطقة'],
    phone: ['هاتف', 'رقم الهاتف', 'موبايل', 'اتصال'],
    governorate: ['محافظة', 'الولاية', 'الإقليم']
  }
};

// Function to find the best matching column for a field
function findMatchingColumn(headerRow, fieldMappings) {
  for (const [field, possibleHeaders] of Object.entries(fieldMappings)) {
    for (const header of possibleHeaders) {
      // Case-insensitive partial match
      const matchedColumn = headerRow.find(col => 
        col.toLowerCase().includes(header.toLowerCase())
      );
      if (matchedColumn) {
        return { field, column: matchedColumn };
      }
    }
  }
  return null;
}

// Function to normalize and clean data
function normalizeData(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Convert to string and clean
  let cleaned = String(value).trim();
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Handle common data cleaning
  if (cleaned.toLowerCase() === 'n/a' || cleaned.toLowerCase() === 'null') {
    return null;
  }
  
  return cleaned || null;
}

// Function to map Excel row to database format
function mapRowToBusiness(row, mapping, headers) {
  const business = {
    name: null,
    category: null,
    city: null,
    phone: null,
    governorate: null,
    requested_category: 'General Directory', // Default value
    confidence: 0.8, // Default confidence for uploaded data
    status: 'validated'
  };

  // Map each field using the detected column mapping
  for (const [field, column] of Object.entries(mapping)) {
    const columnIndex = headers.indexOf(column);
    if (columnIndex !== -1 && row[columnIndex] !== undefined) {
      business[field] = normalizeData(row[columnIndex]);
    }
  }

  // Set requested_category to be the same as category if category exists
  if (business.category) {
    business.requested_category = business.category;
  }

  return business;
}

// Main upload function
async function uploadExcelToSupabase(filePath) {
  try {
    console.log('Reading Excel file:', filePath);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    console.log(`Found ${headers.length} columns and ${rows.length} data rows`);
    console.log('Headers:', headers);

    // Try to find the best column mapping
    let bestMapping = null;
    let mappingType = null;

    // Try standard mapping first
    const standardMapping = {};
    for (const [field, possibleHeaders] of Object.entries(columnMappings.standard)) {
      const match = findMatchingColumn(headers, { [field]: possibleHeaders });
      if (match) {
        standardMapping[field] = match.column;
      }
    }

    // Try alternative mapping if standard doesn't work well
    const alternativeMapping = {};
    for (const [field, possibleHeaders] of Object.entries(columnMappings.alternative)) {
      const match = findMatchingColumn(headers, { [field]: possibleHeaders });
      if (match) {
        alternativeMapping[field] = match.column;
      }
    }

    // Choose the mapping with more matches
    const standardMatches = Object.keys(standardMapping).length;
    const alternativeMatches = Object.keys(alternativeMapping).length;

    if (standardMatches >= alternativeMatches) {
      bestMapping = standardMapping;
      mappingType = 'standard';
    } else {
      bestMapping = alternativeMapping;
      mappingType = 'alternative';
    }

    console.log(`Using ${mappingType} mapping:`, bestMapping);

    if (Object.keys(bestMapping).length < 3) {
      throw new Error('Could not find sufficient matching columns. Please check your Excel headers.');
    }

    // Create a job for tracking
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        governorate: 'Excel Upload',
        category: 'Directory Import',
        status: 'running',
        progress: 0
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log('Created job:', job.id);

    // Process rows in batches
    const batchSize = 100;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const businesses = [];

      for (const row of batch) {
        const business = mapRowToBusiness(row, bestMapping, headers);
        
        // Skip rows without essential data
        if (!business.name) {
          continue;
        }

        businesses.push({
          ...business,
          job_id: job.id
        });
      }

      if (businesses.length > 0) {
        // Insert batch into staging_businesses
        const { data: insertedData, error: insertError } = await supabase
          .from('staging_businesses')
          .insert(businesses)
          .select();

        if (insertError) {
          console.error(`Batch insert error: ${insertError.message}`);
          errorCount += businesses.length;
        } else {
          successCount += insertedData.length;
          console.log(`Batch ${Math.floor(i/batchSize) + 1}: Inserted ${insertedData.length} records`);
        }
      }

      processedCount += batch.length;
      
      // Update job progress
      const progress = Math.round((processedCount / rows.length) * 100);
      await supabase
        .from('jobs')
        .update({ 
          progress, 
          businesses_found: processedCount,
          businesses_saved: successCount
        })
        .eq('id', job.id);
    }

    // Complete the job
    await supabase
      .from('jobs')
      .update({ 
        status: 'done',
        completed_at: new Date().toISOString(),
        businesses_found: processedCount,
        businesses_saved: successCount
      })
      .eq('id', job.id);

    console.log(`\nUpload completed!`);
    console.log(`Total rows processed: ${processedCount}`);
    console.log(`Successfully inserted: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Job ID: ${job.id}`);

    return {
      jobId: job.id,
      totalProcessed: processedCount,
      successCount,
      errorCount
    };

  } catch (error) {
    console.error('Upload failed:', error.message);
    throw error;
  }
}

// Run the upload
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node upload-excel-to-supabase.js <excel-file-path>');
  process.exit(1);
}

uploadExcelToSupabase(filePath)
  .then(result => {
    console.log('\nUpload completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nUpload failed:', error.message);
    process.exit(1);
  });
