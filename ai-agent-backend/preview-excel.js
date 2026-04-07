const XLSX = require('xlsx');

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

// Function to preview Excel file
function previewExcelFile(filePath) {
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
    const rows = data.slice(1, 6); // Show first 5 data rows
    
    console.log(`\n=== EXCEL FILE PREVIEW ===`);
    console.log(`Sheet: ${sheetName}`);
    console.log(`Total columns: ${headers.length}`);
    console.log(`Total rows: ${data.length - 1}`);
    console.log(`\nHeaders found:`);
    headers.forEach((header, index) => {
      console.log(`  ${index + 1}. "${header}"`);
    });

    console.log(`\n=== COLUMN MAPPING ANALYSIS ===`);
    
    // Try standard mapping first
    const standardMapping = {};
    for (const [field, possibleHeaders] of Object.entries(columnMappings.standard)) {
      const match = findMatchingColumn(headers, { [field]: possibleHeaders });
      if (match) {
        standardMapping[field] = match.column;
      }
    }

    // Try alternative mapping
    const alternativeMapping = {};
    for (const [field, possibleHeaders] of Object.entries(columnMappings.alternative)) {
      const match = findMatchingColumn(headers, { [field]: possibleHeaders });
      if (match) {
        alternativeMapping[field] = match.column;
      }
    }

    console.log(`\nStandard mapping matches: ${Object.keys(standardMapping).length}`);
    Object.entries(standardMapping).forEach(([field, column]) => {
      console.log(`  ${field} -> "${column}"`);
    });

    console.log(`\nAlternative mapping matches: ${Object.keys(alternativeMapping).length}`);
    Object.entries(alternativeMapping).forEach(([field, column]) => {
      console.log(`  ${field} -> "${column}"`);
    });

    console.log(`\n=== SAMPLE DATA (first 5 rows) ===`);
    rows.forEach((row, rowIndex) => {
      console.log(`\nRow ${rowIndex + 1}:`);
      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        if (value !== undefined && value !== null && value !== '') {
          console.log(`  ${header}: "${value}"`);
        }
      });
    });

    // Recommend best mapping
    const standardMatches = Object.keys(standardMapping).length;
    const alternativeMatches = Object.keys(alternativeMapping).length;
    
    console.log(`\n=== RECOMMENDATION ===`);
    if (standardMatches >= alternativeMatches && standardMatches >= 3) {
      console.log('✅ Use STANDARD mapping');
      console.log('Required fields found:', Object.keys(standardMapping).join(', '));
    } else if (alternativeMatches >= 3) {
      console.log('✅ Use ALTERNATIVE mapping');
      console.log('Required fields found:', Object.keys(alternativeMapping).join(', '));
    } else {
      console.log('⚠️  WARNING: Less than 3 required fields matched!');
      console.log('You may need to manually adjust the column mappings.');
    }

    return {
      headers,
      totalRows: data.length - 1,
      standardMapping,
      alternativeMapping,
      recommendedMapping: standardMatches >= alternativeMatches ? standardMapping : alternativeMapping
    };

  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    throw error;
  }
}

// Run the preview
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node preview-excel.js <excel-file-path>');
  process.exit(1);
}

previewExcelFile(filePath);
