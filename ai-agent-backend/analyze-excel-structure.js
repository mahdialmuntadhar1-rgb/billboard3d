const XLSX = require('xlsx');

function analyzeExcelStructure(filePath) {
  try {
    console.log('Analyzing Excel file structure:', filePath);
    
    const workbook = XLSX.readFile(filePath);
    console.log('Available sheets:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    console.log(`Sheet range: ${worksheet['!ref']}`);
    console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);
    
    // Try different parsing methods
    console.log('\n=== METHOD 1: Row-based parsing ===');
    const data1 = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`Method 1 returned ${data1.length} rows`);
    if (data1.length > 0) {
      console.log('First row columns:', data1[0].length);
      console.log('Sample first row:', data1[0].slice(0, 3));
    }
    
    console.log('\n=== METHOD 2: Column-based parsing ===');
    const data2 = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Method 2 returned ${data2.length} rows`);
    if (data2.length > 0) {
      console.log('Sample first row keys:', Object.keys(data2[0]));
      console.log('Sample first row:', data2[0]);
    }
    
    console.log('\n=== METHOD 3: Raw cell analysis ===');
    // Look at first 20 cells to understand structure
    const cells = [];
    for (let row = 0; row < Math.min(20, range.e.r + 1); row++) {
      for (let col = 0; col < Math.min(5, range.e.c + 1); col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cellValue = worksheet[cellAddress]?.v || worksheet[cellAddress]?.w || '[empty]';
        cells.push(`Row ${row + 1}, Col ${col + 1}: "${cellValue}"`);
      }
    }
    cells.forEach(cell => console.log(cell));
    
    // Check if it's actually a CSV saved as Excel
    console.log('\n=== CHECKING FOR CSV-LIKE STRUCTURE ===');
    if (data1.length > 0 && data1[0].length === 1) {
      console.log('Single column detected - checking if it contains delimited data...');
      const firstCell = data1[0][0];
      if (typeof firstCell === 'string' && (firstCell.includes(',') || firstCell.includes('\t'))) {
        console.log('✅ Detected delimited data in single column');
        console.log('Sample:', firstCell.substring(0, 200));
      }
    }
    
  } catch (error) {
    console.error('Error analyzing Excel file:', error.message);
  }
}

// Run analysis
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node analyze-excel-structure.js <excel-file-path>');
  process.exit(1);
}

analyzeExcelStructure(filePath);
