// Simple test script for the AI Agent API
const http = require('http');

const testData = {
  governorate: "Baghdad",
  category: "restaurants"
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/run-agent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing AI Agent API...');
console.log('Request:', testData);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('\n✅ Test completed successfully!');
      console.log(`Found ${parsed.count} businesses`);
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

console.log('\n💡 Make sure the server is running: npm start');
console.log('💡 Make sure your .env file is configured with API keys');
