const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Column mapping for the Iraq directory Excel structure
const columnMapping = {
  name: 'English Name',
  arabic_name: 'Arabic Name', 
  business_name: 'Business Name',
  category: 'Category',
  subcategory: 'Subcategory',
  governorate: 'Governorate',
  city: 'City',
  neighborhood: 'Neighborhood',
  phone1: 'Phone 1',
  phone2: 'Phone 2',
  whatsapp: 'WhatsApp',
  email1: 'Email 1',
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  opening_hours: 'Opening Hours',
  status: 'Status',
  rating: 'Rating',
  verification: 'Verification',
  confidence: 'Confidence',
  type: 'Type',
  id: 'ID'
};

// Function to normalize and clean data
function normalizeData(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  let cleaned = String(value).trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  if (cleaned.toLowerCase() === 'n/a' || cleaned.toLowerCase() === 'null' || cleaned === '-') {
    return null;
  }
  
  return cleaned || null;
}

// Function to combine phone numbers
function combinePhones(phone1, phone2, whatsapp) {
  const phones = [];
  
  if (phone1) phones.push(phone1);
  if (phone2 && phone2 !== phone1) phones.push(phone2);
  if (whatsapp && whatsapp !== phone1 && whatsapp !== phone2) phones.push(whatsapp);
  
  return phones.length > 0 ? phones.join(', ') : null;
}

// Function to map Excel row to database format
function mapRowToBusiness(row, headers) {
  // Create a mapping from header to column index
  const headerToIndex = {};
  headers.forEach((header, index) => {
    headerToIndex[header] = index;
  });

  // Extract data using the mapping
  const getData = (fieldName) => {
    const header = columnMapping[fieldName];
    const columnIndex = headerToIndex[header];
    return columnIndex !== undefined ? normalizeData(row[columnIndex]) : null;
  };

  const name = getData('english_name') || getData('business_name') || getData('arabic_name');
  const category = getData('category') || 'General Business';
  const city = getData('city') || 'Unknown';
  const governorate = getData('governorate') || 'Unknown';
  const phone1 = getData('phone1');
  const phone2 = getData('phone2');
  const whatsapp = getData('whatsapp');
  const phone = combinePhones(phone1, phone2, whatsapp);

  // Ensure all required fields have values
  if (!name) return null; // Skip if no name
  if (!category || category === 'Unknown') return null; // Skip if no valid category
  if (!city || city === 'Unknown') return null; // Skip if no valid city
  if (!governorate || governorate === 'Unknown') return null; // Skip if no valid governorate

  return {
    name: name,
    category: category,
    city: city,
    phone: phone,
    governorate: governorate,
    source: 'excel_upload',
    confidence: 0.9
  };
}

// Main upload function
async function uploadIraqDirectory(filePath) {
  try {
    console.log('Reading Iraq Business Directory Excel file:', filePath);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with proper header handling
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 3) {
      throw new Error('Excel file must have at least a title row, header row, and one data row');
    }

    // Skip the first row (title) and use second row as headers
    const headers = data[1];
    const dataRows = data.slice(2);
    
    console.log(`Found ${headers.length} columns and ${dataRows.length} data rows`);
    console.log('Headers:', headers);

    // Validate required columns
    const requiredColumns = ['English Name', 'Category', 'Governorate', 'City'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('Warning: Missing recommended columns:', missingColumns);
    }

    // Create a job for tracking
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        governorate: 'Iraq Directory Upload',
        category: 'Business Directory Import',
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
    let skippedCount = 0;

    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      const businesses = [];

      for (const row of batch) {
        const business = mapRowToBusiness(row, headers);
        
        // Skip rows without essential data
        if (!business.name) {
          skippedCount++;
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
      const progress = Math.round((processedCount / dataRows.length) * 100);
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

    console.log(`\n=== UPLOAD COMPLETED ===`);
    console.log(`Total rows processed: ${processedCount}`);
    console.log(`Successfully inserted: ${successCount}`);
    console.log(`Skipped (no name): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Job ID: ${job.id}`);

    // Show sample data
    console.log(`\n=== SAMPLE UPLOADED DATA ===`);
    const { data: sampleData } = await supabase
      .from('staging_businesses')
      .select('name, category, city, governorate, phone')
      .eq('job_id', job.id)
      .limit(5);

    if (sampleData) {
      sampleData.forEach((business, index) => {
        console.log(`\n${index + 1}. ${business.name}`);
        console.log(`   Category: ${business.category}`);
        console.log(`   Location: ${business.city}, ${business.governorate}`);
        console.log(`   Phone: ${business.phone || 'N/A'}`);
      });
    }

    return {
      jobId: job.id,
      totalProcessed: processedCount,
      successCount,
      errorCount,
      skippedCount
    };

  } catch (error) {
    console.error('Upload failed:', error.message);
    throw error;
  }
}

// Run the upload
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node upload-iraq-directory.js <excel-file-path>');
  process.exit(1);
}

uploadIraqDirectory(filePath)
  .then(result => {
    console.log('\n✅ Upload completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Upload failed:', error.message);
    process.exit(1);
  });
