const XLSX = require('xlsx');

function debugExcelParsing() {
    try {
        console.log('Debugging Excel file parsing...');
        
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        const worksheet = workbook.Sheets['All 1800 Businesses'];
        
        // Convert to JSON with proper headers
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`Total rows found: ${data.length}`);
        
        // Check first few rows in detail
        console.log('\nFirst 5 rows detailed analysis:');
        for (let i = 0; i < Math.min(5, data.length); i++) {
            const business = data[i];
            console.log(`\nRow ${i + 1}:`);
            console.log('All keys:', Object.keys(business));
            console.log('Business Name:', `"${business['Business Name']}"`);
            console.log('English Name:', `"${business['English Name']}"`);
            console.log('Category:', `"${business['Category']}"`);
            console.log('City:', `"${business['City']}"`);
            console.log('Governorate:', `"${business['Governorate']}"`);
            
            // Check if any of these are undefined or empty
            const name = business['Business Name'] || business['English Name'] || '';
            const category = business['Category'] || '';
            const city = business['City'] || '';
            const governorate = business['Governorate'] || '';
            
            console.log(`Processed - Name: "${name}", Category: "${category}", City: "${city}", Governorate: "${governorate}"`);
            console.log(`Has required fields: ${!!name && !!category && !!city && !!governorate}`);
        }
        
        // Check if there's an issue with the header parsing
        console.log('\nChecking raw data structure...');
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('Raw headers:', rawData[0]);
        console.log('Raw first data row:', rawData[1]);
        
    } catch (error) {
        console.error('Error debugging Excel:', error);
    }
}

debugExcelParsing();
