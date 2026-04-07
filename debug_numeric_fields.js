const XLSX = require('xlsx');

function debugNumericFields() {
    try {
        console.log('🔍 Debugging numeric fields in Excel...');
        
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        const worksheet = workbook.Sheets['All 1800 Businesses'];
        
        // Convert to raw data first to handle the header issue
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip the first row (merged title) and use the second row as headers
        const headers = rawData[1];
        const dataRows = rawData.slice(2);
        
        // Convert to proper JSON format
        const data = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        }).filter(row => row['Business Name'] && row['Business Name'].trim());
        
        console.log(`Checking first 10 records for numeric issues...`);
        
        // Check numeric fields
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const business = data[i];
            console.log(`\nRecord ${i + 1}: ${business['Business Name']}`);
            
            const rating = business['Rating'];
            const confidence = business['Confidence'];
            
            console.log(`Rating: "${rating}" (type: ${typeof rating})`);
            console.log(`Confidence: "${confidence}" (type: ${typeof confidence})`);
            
            // Try to parse them
            const parsedRating = rating ? parseFloat(rating) : null;
            const parsedConfidence = confidence ? parseInt(confidence) : null;
            
            console.log(`Parsed Rating: ${parsedRating} (type: ${typeof parsedRating})`);
            console.log(`Parsed Confidence: ${parsedConfidence} (type: ${typeof parsedConfidence})`);
            
            // Check for potential issues
            if (parsedRating !== null && (isNaN(parsedRating) || !isFinite(parsedRating))) {
                console.log(`⚠️  Invalid rating: ${rating}`);
            }
            
            if (parsedConfidence !== null && (isNaN(parsedConfidence) || !isFinite(parsedConfidence))) {
                console.log(`⚠️  Invalid confidence: ${confidence}`);
            }
            
            if (parsedConfidence !== null && (parsedConfidence < 0 || parsedConfidence > 100)) {
                console.log(`⚠️  Confidence out of range: ${parsedConfidence}`);
            }
        }
        
    } catch (error) {
        console.error('Error debugging numeric fields:', error);
    }
}

debugNumericFields();
