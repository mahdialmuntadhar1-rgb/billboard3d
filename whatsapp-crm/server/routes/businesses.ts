import { Router } from 'express';
import { fetchTargetBusinesses, getBusinessStats, getFilterOptions } from '../services/businessService';

const router = Router();

// GET /api/businesses/preview - Preview businesses matching campaign filters
router.get('/preview', async (req, res) => {
  try {
    const { governorate, city, category, status = 'approved' } = req.query;

    console.log('[businesses/preview] Preview request:', { governorate, city, category, status });

    const stats = await getBusinessStats({
      governorate: governorate as string,
      city: city as string,
      category: category as string,
      status: status as string
    });

    res.json({
      success: true,
      stats,
      filters: { governorate, city, category, status }
    });

  } catch (error: any) {
    console.error('[businesses/preview] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/businesses/preview/sample - Get sample businesses for display
router.get('/preview/sample', async (req, res) => {
  try {
    const { governorate, city, category, status = 'approved', limit = 10 } = req.query;

    console.log('[businesses/preview/sample] Sample request:', { governorate, city, category, status, limit });

    const { businesses } = await fetchTargetBusinesses({
      governorate: governorate as string,
      city: city as string,
      category: category as string,
      status: status as string
    });

    // Limit to requested number for preview
    const sampleBusinesses = businesses.slice(0, parseInt(limit as string));

    // Add phone selection info
    const businessesWithPhones = sampleBusinesses.map(business => {
      const phoneInfo = require('../services/businessService').selectBestPhone(business);
      return {
        ...business,
        selectedPhone: phoneInfo?.phone || null,
        selectedPhoneField: phoneInfo?.field || null
      };
    });

    res.json({
      success: true,
      businesses: businessesWithPhones,
      total: businesses.length,
      sampleCount: businessesWithPhones.length
    });

  } catch (error: any) {
    console.error('[businesses/preview/sample] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/businesses/filters - Get available filter options
router.get('/filters', async (req, res) => {
  try {
    const options = await getFilterOptions();

    res.json({
      success: true,
      ...options
    });

  } catch (error: any) {
    console.error('[businesses/filters] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/businesses/queue - Queue messages for businesses (replaces mock approach)
router.post('/queue', async (req, res) => {
  try {
    const { campaign_id, filters, test_mode = false, test_limit = 10 } = req.body;

    console.log('[businesses/queue] Queue request:', { campaign_id, filters, test_mode, test_limit });

    if (!campaign_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campaign ID is required' 
      });
    }

    // Fetch businesses matching filters
    const { businesses } = await fetchTargetBusinesses({
      governorate: filters?.governorate,
      city: filters?.city,
      category: filters?.category,
      status: 'approved'
    });

    if (businesses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No businesses found matching the specified filters'
      });
    }

    // Apply test mode limit if enabled
    let businessesToQueue = businesses;
    if (test_mode) {
      businessesToQueue = businesses.slice(0, test_limit);
      console.log(`[businesses/queue] Test mode: limiting to ${businessesToQueue.length} businesses`);
    }

    // Prepare businesses for message queuing
    const businessesForQueue = businessesToQueue.map(business => {
      const phoneInfo = require('../services/businessService').selectBestPhone(business);
      return {
        id: business.id,
        name: business.business_name,
        phone: phoneInfo?.phone,
        phone_field: phoneInfo?.field,
        city: business.city,
        category: business.category,
        governorate: business.governorate
      };
    }).filter(b => b.phone); // Only include businesses with valid phones

    if (businessesForQueue.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No businesses with valid phone numbers found'
      });
    }

    console.log(`[businesses/queue] Prepared ${businessesForQueue.length} businesses for queuing`);

    res.json({
      success: true,
      businesses: businessesForQueue,
      total_matched: businesses.length,
      total_with_phones: businessesForQueue.length,
      test_mode,
      test_limit: test_mode ? test_limit : null
    });

  } catch (error: any) {
    console.error('[businesses/queue] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
