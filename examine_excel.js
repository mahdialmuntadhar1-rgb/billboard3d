const XLSX = require('xlsx');

function examineExcelFile() {
    try {
        console.log('Examining Excel file...');
        
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        
        // Get sheet names
        const sheetNames = workbook.SheetNames;
        console.log('Sheet names:', sheetNames);
        
        // Examine each sheet
        for (const sheetName of sheetNames) {
            console.log(`\n=== Sheet: ${sheetName} ===`);
            
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (data.length > 0) {
                console.log(`Total rows: ${data.length}`);
                console.log('Headers:', data[0]);
                
                // Show first few rows of data
                console.log('Sample data (first 3 rows):');
                for (let i = 1; i < Math.min(4, data.length); i++) {
                    console.log(`Row ${i}:`, data[i]);
                }
                
                // Check column types
                if (data.length > 1) {
                    const headers = data[0];
                    const sampleRow = data[1];
                    console.log('Column analysis:');
                    headers.forEach((header, index) => {
                        const value = sampleRow[index];
                        console.log(`  ${header}: ${typeof value} (${value})`);
                    });
                }
            } else {
                console.log('Sheet is empty');
            }
        }
        
    } catch (error) {
        console.error('Error examining Excel file:', error);
    }
}

examineExcelFile();
