const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { runAgent, resumeInterruptedJobs } = require('./src/agent');
const { runAutoContinue, runFullIraqCoverage } = require('./src/auto-continue');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Resume interrupted jobs on server startup
async function initializeServer() {
  try {
    console.log('🚀 Initializing AI Agent Backend...');
    await resumeInterruptedJobs();
    console.log('✅ Server initialization completed');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
  }
}

// API Routes
app.post('/api/run-agent', async (req, res) => {
  try {
    const { governorate, category } = req.body;

    // Validate input
    if (!governorate || !category) {
      return res.status(400).json({
        success: false,
        error: 'Both governorate and category are required'
      });
    }

    console.log(`Starting agent for ${category} in ${governorate}`);
    
    // Run the agent
    const result = await runAgent(governorate, category);

    res.json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Auto-continue endpoints
app.post('/api/auto-continue', async (req, res) => {
  try {
    const { governorate, startCategory } = req.body;

    if (!governorate) {
      return res.status(400).json({
        success: false,
        error: 'Governorate is required'
      });
    }

    console.log(`Starting auto-continue for ${governorate}`);
    
    // Run auto-continue in background (fire and forget)
    runAutoContinue(governorate, startCategory).catch(error => {
      console.error('Auto-continue error:', error);
    });

    res.json({
      success: true,
      message: `Auto-continue started for ${governorate}`,
      status: 'running'
    });

  } catch (error) {
    console.error('Auto-continue start error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/full-iraq-coverage', async (req, res) => {
  try {
    console.log('Starting full Iraq coverage');
    
    // Run full coverage in background (fire and forget)
    runFullIraqCoverage().catch(error => {
      console.error('Full Iraq coverage error:', error);
    });

    res.json({
      success: true,
      message: 'Full Iraq coverage started',
      status: 'running',
      note: 'This will run through all governorates and categories'
    });

  } catch (error) {
    console.error('Full coverage start error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`AI Agent Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`\n🚀 Available endpoints:`);
  console.log(`  POST /api/run-agent - Run single agent`);
  console.log(`  POST /api/auto-continue - Run all categories for a governorate`);
  console.log(`  POST /api/full-iraq-coverage - Run all governorates and categories`);
  
  // Initialize server (resume jobs)
  await initializeServer();
});
