// API Routes for Agent Management
// Vercel Functions - Supabase Only

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/agents/list - List all agents with status
 */
export async function listAgents(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select(`
        *,
        jobs:agent_jobs(
          id,
          status,
          records_scraped,
          records_enriched,
          records_reviewed,
          records_pushed,
          progress_pct,
          started_at,
          completed_at
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const formatted = (agents || []).map(agent => ({
      agentId: agent.id,
      governorate: agent.governorate,
      category: agent.category,
      status: agent.status,
      currentCheckpoint: agent.current_checkpoint,
      lastHeartbeat: agent.last_heartbeat,
      totalRecords: agent.total_records,
      pushedRecords: agent.push_count,
      activeJobs: agent.jobs?.filter((j: any) => j.status === 'RUNNING').length || 0,
      recentJobs: (agent.jobs || []).slice(0, 5)
    }));

    return res.status(200).json({ agents: formatted });
  } catch (error) {
    console.error('[API] List agents error:', error);
    return res.status(500).json({ error: 'Failed to list agents' });
  }
}

/**
 * GET /api/agents/:agentId - Get agent details
 */
export async function getAgent(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { agentId } = req.query;
  
  if (!agentId) {
    return res.status(400).json({ error: 'Agent ID required' });
  }

  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        jobs:agent_jobs(*),
        checkpoints:agent_checkpoints(*)
      `)
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get current job if running
    const currentJob = agent.jobs?.find((j: any) => j.status === 'RUNNING');

    return res.status(200).json({
      agentId: agent.id,
      governorate: agent.governorate,
      category: agent.category,
      status: agent.status,
      currentCheckpoint: agent.current_checkpoint,
      stats: {
        totalRecords: agent.total_records,
        scraped: agent.scrape_count,
        enriched: agent.enrich_count,
        reviewed: agent.review_count,
        pushed: agent.push_count,
        errors: agent.error_count
      },
      currentJob: currentJob || null,
      recentCheckpoints: (agent.checkpoints || []).slice(0, 10),
      lastHeartbeat: agent.last_heartbeat
    });
  } catch (error) {
    console.error('[API] Get agent error:', error);
    return res.status(500).json({ error: 'Failed to get agent' });
  }
}

/**
 * GET /api/jobs/:jobId/status - Get job status
 */
export async function getJobStatus(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { jobId } = req.query;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID required' });
  }

  try {
    const { data: job, error } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get staging record counts by stage
    const { data: stageCounts } = await supabase
      .from('business_records_staging')
      .select('pipeline_stage, count')
      .eq('job_id', jobId)
      .group('pipeline_stage');

    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      governorate: job.governorate,
      category: job.category,
      sourceType: job.source_type,
      progress: {
        pct: job.progress_pct,
        scraped: job.records_scraped,
        enriched: job.records_enriched,
        reviewed: job.records_reviewed,
        pushed: job.records_pushed
      },
      stageBreakdown: stageCounts || [],
      startedAt: job.started_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message
    });
  } catch (error) {
    console.error('[API] Job status error:', error);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
}

/**
 * GET /api/records/review-queue - Get records needing review
 */
export async function getReviewQueue(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { governorate, limit = '50' } = req.query;
    
    let query = supabase
      .from('business_records_staging')
      .select('*')
      .eq('review_status', 'PENDING')
      .lt('confidence', 0.7)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit as string));

    if (governorate) {
      query = query.eq('governorate', governorate);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    const formatted = (records || []).map(r => ({
      recordId: r.id,
      name: r.name,
      nameAr: r.name_ar,
      nameKu: r.name_ku,
      phone: r.phone_formatted || r.phone,
      category: r.category,
      governorate: r.governorate,
      city: r.city,
      address: r.address,
      language: r.language,
      confidence: r.confidence,
      enrichmentIssues: r.enrichment_issues || [],
      source: r.source,
      sourceUrl: r.source_url
    }));

    return res.status(200).json({
      records: formatted,
      count: formatted.length,
      filters: { governorate }
    });
  } catch (error) {
    console.error('[API] Review queue error:', error);
    return res.status(500).json({ error: 'Failed to get review queue' });
  }
}

/**
 * POST /api/records/approve - Approve or reject a record
 */
export async function approveRecord(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recordId, decision, notes } = req.body;
    
    if (!recordId || !decision) {
      return res.status(400).json({ error: 'Missing recordId or decision' });
    }

    const updates: any = {
      review_status: decision,
      review_notes: notes || null,
      reviewed_by: req.headers['x-user-id'] || 'system',
      updated_at: new Date().toISOString()
    };

    if (decision === 'APPROVED') {
      updates.pipeline_stage = 'REVIEWED';
    } else if (decision === 'REJECTED') {
      updates.pipeline_stage = 'SCRAPED'; // Back to start
    }

    const { data, error } = await supabase
      .from('business_records_staging')
      .update(updates)
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      recordId,
      decision,
      updated: true,
      record: data
    });
  } catch (error) {
    console.error('[API] Approve record error:', error);
    return res.status(500).json({ error: 'Failed to approve record' });
  }
}

/**
 * GET /api/health - System health check
 */
export async function healthCheck(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Check database connection
    const { error: dbError } = await supabase
      .from('agents')
      .select('id', { count: 'exact', head: true });

    if (dbError) {
      return res.status(503).json({
        status: 'ERROR',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }

    // Get stats
    const [
      { count: totalAgents },
      { count: runningJobs },
      { count: pendingReviews }
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'RUNNING'),
      supabase.from('business_records_staging').select('*', { count: 'exact', head: true }).eq('review_status', 'PENDING')
    ]);

    // Get pipeline stats
    const { data: pipelineStats } = await supabase
      .from('business_records_staging')
      .select('pipeline_stage, count')
      .group('pipeline_stage');

    return res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      stats: {
        totalAgents: totalAgents || 0,
        runningJobs: runningJobs || 0,
        pendingReviews: pendingReviews || 0,
        pipelineBreakdown: pipelineStats || []
      }
    });
  } catch (error) {
    console.error('[API] Health check error:', error);
    return res.status(503).json({
      status: 'ERROR',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/export - Export records (CSV or Excel)
 */
export async function exportRecords(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { 
      format = 'csv',
      governorate,
      category,
      phone_category,
      language,
      city 
    } = req.query;

    // Build query
    let query = supabase
      .from('business_records_production')
      .select('*')
      .order('name', { ascending: true });

    if (governorate) query = query.eq('governorate', governorate);
    if (category) query = query.eq('category', category);
    if (phone_category) query = query.eq('phone_category', phone_category);
    if (language) query = query.eq('language', language);
    if (city) query = query.eq('city', city);

    const { data: records, error } = await query;

    if (error) throw error;

    if (format === 'csv') {
      const csv = generateCSV(records || []);
      const bom = '\uFEFF'; // UTF-8 BOM for Excel
      
      // Log export
      await supabase.from('export_logs').insert({
        export_type: 'csv',
        filters: { governorate, category, phone_category, language, city },
        record_count: records?.length || 0,
        encoding: 'utf8',
        created_at: new Date().toISOString()
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="iraq-compass-export-${Date.now()}.csv"`);
      return res.status(200).send(bom + csv);
    } else {
      return res.status(400).json({ error: 'Excel format not yet implemented' });
    }
  } catch (error) {
    console.error('[API] Export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}

function generateCSV(records: any[]): string {
  if (records.length === 0) return '';
  
  const headers = [
    'Name (English)',
    'Name (Arabic)',
    'Name (Kurdish)',
    'Phone',
    'Has Phone',
    'Phone Category',
    'WhatsApp',
    'Category',
    'Governorate',
    'City',
    'Address',
    'Language',
    'Sources',
    'Confidence',
    'Verified Via',
    'Pushed At'
  ];

  const rows = records.map(r => [
    r.name,
    r.name_ar || '',
    r.name_ku || '',
    r.phone || '',
    r.has_phone ? 'Yes' : 'No',
    r.phone_category || '',
    r.whatsapp || '',
    r.category,
    r.governorate,
    r.city || '',
    r.address || '',
    r.language || '',
    (r.sources || []).join(', '),
    r.confidence_final || 0,
    (r.verified_via || []).join(', '),
    r.pushed_at || ''
  ]);

  const escapeCSV = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  return [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
}
