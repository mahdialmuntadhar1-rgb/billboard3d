import { Router, Request as IttyRequest } from 'itty-router';
import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../durable_objects/GovernorateAgent';
import { JobStatusResponse } from '../types';

// ============================================
// Job Routes
// ============================================

export function createJobsRouter(env: Env): Router {
  const router = Router({ base: '/api/jobs' });

  // GET /api/jobs/:jobId/status - Get job status
  router.get('/:jobId/status', async (request: IttyRequest) => {
    try {
      const { jobId } = request.params || {};

      if (!jobId) {
        return jsonResponse({ error: 'Job ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: job, error } = await supabase
        .from('agent_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return jsonResponse({ error: 'Job not found' }, 404);
      }

      // Get total records in staging for this job
      const { count: totalRecords } = await supabase
        .from('business_records_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      // Get next checkpoint
      const stageOrder = ['SCRAPED', 'ENRICHED', 'REVIEWED', 'CLEANED', 'READY_FOR_PUSH'];
      const currentIndex = stageOrder.indexOf(job.pipeline_stage || 'SCRAPED');
      const nextCheckpoint = currentIndex < stageOrder.length - 1
        ? stageOrder[currentIndex + 1]
        : null;

      const response: JobStatusResponse = {
        jobId: job.id,
        stage: job.pipeline_stage || 'SCRAPED',
        progressPct: job.progress_pct || 0,
        recordsProcessed: job.records_pushed || 0,
        recordsTotal: totalRecords || 0,
        nextCheckpoint,
      };

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Error getting job status:', error);
      return jsonResponse({ error: 'Failed to get job status' }, 500);
    }
  });

  // GET /api/jobs/agent/:agentId - List jobs for an agent
  router.get('/agent/:agentId', async (request: IttyRequest) => {
    try {
      const { agentId } = request.params || {};

      if (!agentId) {
        return jsonResponse({ error: 'Agent ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: jobs, error } = await supabase
        .from('agent_jobs')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return jsonResponse({
        agentId,
        jobs: jobs || [],
      });

    } catch (error) {
      console.error('[API] Error listing jobs:', error);
      return jsonResponse({ error: 'Failed to list jobs' }, 500);
    }
  });

  // DELETE /api/jobs/:jobId - Cancel/delete a job
  router.delete('/:jobId', async (request: IttyRequest) => {
    try {
      const { jobId } = request.params || {};

      if (!jobId) {
        return jsonResponse({ error: 'Job ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Delete associated staging records first
      await supabase
        .from('business_records_staging')
        .delete()
        .eq('job_id', jobId);

      // Delete checkpoints
      await supabase
        .from('agent_checkpoints')
        .delete()
        .eq('job_id', jobId);

      // Delete job
      const { error } = await supabase
        .from('agent_jobs')
        .delete()
        .eq('id', jobId);

      if (error) {
        throw error;
      }

      return jsonResponse({
        jobId,
        deleted: true,
      });

    } catch (error) {
      console.error('[API] Error deleting job:', error);
      return jsonResponse({ error: 'Failed to delete job' }, 500);
    }
  });

  return router;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
