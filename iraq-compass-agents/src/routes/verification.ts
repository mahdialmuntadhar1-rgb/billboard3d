import { Router, Request as IttyRequest } from 'itty-router';
import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../durable_objects/GovernorateAgent';
import { HealthResponse } from '../types';

// ============================================
// Verification Routes
// ============================================

export function createVerificationRouter(env: Env): Router {
  const router = Router({ base: '/api/verification' });

  // GET /api/verification/:recordId - Verify a specific record
  router.get('/:recordId', async (request: IttyRequest) => {
    try {
      const { recordId } = request.params || {};

      if (!recordId) {
        return jsonResponse({ error: 'Record ID required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get record from staging
      const { data: record, error } = await supabase
        .from('business_records_staging')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error || !record) {
        return jsonResponse({ error: 'Record not found' }, 404);
      }

      // Perform verification checks
      const verification = await verifyRecord(record);

      return jsonResponse({
        recordId,
        name: record.name,
        sources: verification.sources,
        crossSourceConfidence: verification.cross_source_confidence,
        verificationSummary: verification.verification_summary,
      });

    } catch (error) {
      console.error('[API] Error verifying record:', error);
      return jsonResponse({ error: 'Failed to verify record' }, 500);
    }
  });

  // POST /api/verification/check - Bulk verification check
  router.post('/check', async (request: IttyRequest) => {
    try {
      const body = await request.json?.() as { recordIds?: string[] };

      if (!body.recordIds || body.recordIds.length === 0) {
        return jsonResponse({ error: 'recordIds array required' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: records, error } = await supabase
        .from('business_records_staging')
        .select('*')
        .in('id', body.recordIds);

      if (error) {
        throw error;
      }

      const results = await Promise.all(
        (records || []).map(async (record) => {
          const verification = await verifyRecord(record);
          return {
            recordId: record.id,
            name: record.name,
            sources: verification.sources,
            crossSourceConfidence: verification.cross_source_confidence,
          };
        })
      );

      return jsonResponse({
        results,
        totalChecked: results.length,
      });

    } catch (error) {
      console.error('[API] Error bulk verifying records:', error);
      return jsonResponse({ error: 'Failed to verify records' }, 500);
    }
  });

  return router;
}

// ============================================
// Health Check Route
// ============================================

export function createHealthRouter(env: Env): Router {
  const router = Router({ base: '/api/health' });

  router.get('/', async () => {
    try {
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Check database connection
      const { error: dbError } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true });

      if (dbError) {
        return jsonResponse({
          status: 'ERROR',
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
        }, 503);
      }

      // Get stats
      const [{ count: runningAgents }, { count: jobsInProgress }] = await Promise.all([
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'RUNNING'),
        supabase.from('agent_jobs').select('*', { count: 'exact', head: true }).eq('status', 'RUNNING'),
      ]);

      const response: HealthResponse = {
        status: 'OK',
        agentsRunning: runningAgents || 0,
        jobsInProgress: jobsInProgress || 0,
        lastHeartbeat: new Date().toISOString(),
      };

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Health check error:', error);
      return jsonResponse({
        status: 'ERROR',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      }, 503);
    }
  });

  return router;
}

// ============================================
// Verification Logic
// ============================================

async function verifyRecord(record: Record<string, unknown>): Promise<{
  sources: Record<string, unknown>;
  cross_source_confidence: number;
  verification_summary: string;
}> {
  const sources: Record<string, unknown> = {};

  // Check Google Maps
  const mapsResult = await checkGoogleMaps(record);
  if (mapsResult.found) {
    sources.google_maps = mapsResult;
  }

  // Check Wikidata
  const wikiResult = await checkWikidata(record);
  if (wikiResult.found) {
    sources.wikidata = wikiResult;
  }

  // Check web sources
  const webResult = await checkWebSources(record);
  if (webResult.found) {
    sources.web = webResult;
  }

  // Calculate confidence
  const sourceCount = Object.keys(sources).length;
  let confidence: number;
  let summary: string;

  if (sourceCount >= 2) {
    confidence = 0.9;
    summary = 'Verified: Found in multiple sources';
  } else if (sourceCount === 1) {
    confidence = 0.7;
    summary = 'Partially verified: Found in 1 source';
  } else {
    confidence = 0.4;
    summary = 'Unverified: Not found in verification sources';
  }

  return {
    sources,
    cross_source_confidence: confidence,
    verification_summary: summary,
  };
}

async function checkGoogleMaps(record: Record<string, unknown>): Promise<{ found: boolean; url?: string }> {
  // Placeholder - would use Google Places API
  return { found: false };
}

async function checkWikidata(record: Record<string, unknown>): Promise<{ found: boolean; url?: string }> {
  try {
    const name = record.name as string;
    const query = `
      SELECT ?item WHERE {
        ?item rdfs:label ?label .
        FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${name}")))
      }
      LIMIT 1
    `;

    const response = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'IraqCompass/1.0',
        },
      }
    );

    if (!response.ok) return { found: false };

    const data = await response.json();
    if (data.results?.bindings?.length > 0) {
      const entityId = data.results.bindings[0].item.value.split('/').pop();
      return {
        found: true,
        url: `https://www.wikidata.org/wiki/${entityId}`,
      };
    }

    return { found: false };
  } catch {
    return { found: false };
  }
}

async function checkWebSources(record: Record<string, unknown>): Promise<{ found: boolean; url?: string }> {
  // Placeholder - would search Iraqi business directories
  return { found: false };
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
