// Test script for auto-continue functionality
const http = require('http');

function testAutoContinue(governorate) {
  const testData = { governorate };
  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auto-continue',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log(`🚀 Testing auto-continue for ${governorate}...`);
  console.log('This will run through all categories automatically');

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          console.log('\n✅ Auto-continue started successfully!');
          console.log('📝 Check the server logs for progress');
          console.log('⏱️ This will take several minutes to complete');
        } else {
          console.log('\n❌ Auto-continue failed:', parsed.error);
        }
      } catch (e) {
        console.log('\n❌ Response parsing failed:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
  });

  req.write(postData);
  req.end();
}

function testFullIraqCoverage() {
  const postData = JSON.stringify({});

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/full-iraq-coverage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('🇮🇶 Testing full Iraq coverage...');
  console.log('This will run through ALL governorates and categories');
  console.log('⚠️  This will take a very long time to complete!');

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          console.log('\n✅ Full Iraq coverage started!');
          console.log('📝 Check the server logs for progress');
          console.log('⏱️ This will take hours to complete');
        } else {
          console.log('\n❌ Full coverage failed:', parsed.error);
        }
      } catch (e) {
        console.log('\n❌ Response parsing failed:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
  });

  req.write(postData);
  req.end();
}

// Get command line arguments
const args = process.argv.slice(2);
const governorate = args[0];
const fullCoverage = args.includes('--full');

if (fullCoverage) {
  testFullIraqCoverage();
} else if (governorate) {
  testAutoContinue(governorate);
} else {
  console.log('Usage:');
  console.log('  node test-auto-continue.js <governorate>     # Test single governorate');
  console.log('  node test-auto-continue.js --full           # Test full Iraq coverage');
  console.log('');
  console.log('Examples:');
  console.log('  node test-auto-continue.js Baghdad');
  console.log('  node test-auto-continue.js Basra');
  console.log('  node test-auto-continue.js --full');
  console.log('');
  console.log('💡 Make sure the server is running: npm start');
}
