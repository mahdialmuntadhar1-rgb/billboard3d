import { Router, Request as IttyRequest } from 'itty-router';
import { SupabaseClient } from '@supabase/supabase-js';
import { GovernorateAgent, Env } from '../durable_objects/GovernorateAgent';
import {
  StartAgentRequest,
  StartAgentResponse,
  AgentListResponse,
  AgentDetailResponse,
} from '../types';

// ============================================
// Agent Routes
// ============================================

export function createAgentRouter(env: Env): Router {
  const router = Router({ base: '/api/agents' });

  // POST /api/agents/start - Start a new agent
  router.post('/start', async (request: IttyRequest) => {
    try {
      const body = await request.json?.() as StartAgentRequest;

      if (!body.governorate || !body.categories || body.categories.length === 0) {
        return jsonResponse({ error: 'Missing required fields: governorate, categories' }, 400);
      }

      const agentId = `agent-${body.governorate.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Create agent in database
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase.from('agents').insert({
        id: agentId,
        governorate: body.governorate,
        category: body.categories[0], // Primary category
        status: 'IDLE',
        current_checkpoint: 'IDLE',
        total_records: 0,
        scrape_count: 0,
        enrich_count: 0,
        review_count: 0,
        push_count: 0,
        error_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Get or create Durable Object
      const id = env.AGENT_DO.idFromName(agentId);
      const agent = env.AGENT_DO.get(id);

      // Initialize agent
      await agent.initialize(
        agentId,
        body.governorate,
        body.categories,
        body.sources || ['google_maps', 'web_scrape']
      );

      // Start agent (fire-and-forget)
      agent.run().catch(err => {
        console.error(`[Agent ${agentId}] Run error:`, err);
      });

      const response: StartAgentResponse = {
        agentId,
        status: 'RUNNING',
      };

      return jsonResponse(response, 201);

    } catch (error) {
      console.error('[API] Error starting agent:', error);
      return jsonResponse({ error: 'Failed to start agent' }, 500);
    }
  });

  // GET /api/agents/list - List all agents
  router.get('/list', async () => {
    try {
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const response: AgentListResponse[] = (agents || []).map(agent => ({
        agentId: agent.id,
        governorate: agent.governorate,
        status: agent.status,
        currentCheckpoint: agent.current_checkpoint,
        progressPct: calculateProgress(agent),
        recordsScraped: agent.scrape_count,
        recordsPushed: agent.push_count,
      }));

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Error listing agents:', error);
      return jsonResponse({ error: 'Failed to list agents' }, 500);
    }
  });

  // GET /api/agents/:agentId - Get agent details
  router.get('/:agentId', async (request: IttyRequest) => {
    try {
      const { agentId } = request.params || {};

      if (!agentId) {
        return jsonResponse({ error: 'Agent ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get agent info
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        return jsonResponse({ error: 'Agent not found' }, 404);
      }

      // Get checkpoints
      const { data: checkpoints } = await supabase
        .from('agent_checkpoints')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true });

      // Get current job stats
      const { data: jobs } = await supabase
        .from('agent_jobs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'RUNNING')
        .order('started_at', { ascending: false })
        .limit(1);

      const currentJob = jobs?.[0];

      const response: AgentDetailResponse = {
        agentId: agent.id,
        governorate: agent.governorate,
        status: agent.status,
        checkpoints: (checkpoints || []).map(cp => ({
          stage: cp.checkpoint_type,
          timestamp: cp.created_at,
          recordCount: (cp.record_ids || []).length,
        })),
        currentProgress: {
          stage: agent.current_checkpoint,
          processed: currentJob?.records_scraped || 0,
          total: currentJob?.records_scraped || 0, // Estimate
        },
      };

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Error getting agent:', error);
      return jsonResponse({ error: 'Failed to get agent' }, 500);
    }
  });

  // POST /api/agents/:agentId/pause - Pause agent
  router.post('/:agentId/pause', async (request: IttyRequest) => {
    try {
      const { agentId } = request.params || {};

      if (!agentId) {
        return jsonResponse({ error: 'Agent ID required' }, 400);
      }

      const id = env.AGENT_DO.idFromName(agentId);
      const agent = env.AGENT_DO.get(id);

      await agent.pause();

      return jsonResponse({
        agentId,
        status: 'PAUSED',
      });

    } catch (error) {
      console.error('[API] Error pausing agent:', error);
      return jsonResponse({ error: 'Failed to pause agent' }, 500);
    }
  });

  // POST /api/agents/:agentId/resume - Resume agent
  router.post('/:agentId/resume', async (request: IttyRequest) => {
    try {
      const { agentId } = request.params || {};

      if (!agentId) {
        return jsonResponse({ error: 'Agent ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get last checkpoint
      const { data: lastCheckpoint } = await supabase
        .from('agent_checkpoints')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const id = env.AGENT_DO.idFromName(agentId);
      const agent = env.AGENT_DO.get(id);

      await agent.resume();

      return jsonResponse({
        agentId,
        status: 'RUNNING',
        resumedFromCheckpoint: lastCheckpoint?.checkpoint_type || null,
      });

    } catch (error) {
      console.error('[API] Error resuming agent:', error);
      return jsonResponse({ error: 'Failed to resume agent' }, 500);
    }
  });

  return router;
}

// ============================================
// Helper Functions
// ============================================

function calculateProgress(agent: Record<string, number>): number {
  if (agent.total_records === 0) return 0;
  return Math.round((agent.push_count / agent.total_records) * 100);
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
