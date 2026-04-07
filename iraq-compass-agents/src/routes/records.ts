import { Router, Request as IttyRequest } from 'itty-router';
import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../durable_objects/GovernorateAgent';
import { ReviewQueueItem, ApproveRecordRequest, PushResponse } from '../types';

// ============================================
// Records Routes
// ============================================

export function createRecordsRouter(env: Env): Router {
  const router = Router({ base: '/api/records' });

  // GET /api/records/review-queue - Get records needing human review
  router.get('/review-queue', async (request: IttyRequest) => {
    try {
      const url = new URL(request.url || '');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const governorate = url.searchParams.get('governorate') || undefined;

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      let query = supabase
        .from('business_records_staging')
        .select('*')
        .eq('review_status', 'PENDING')
        .lt('confidence', 0.7)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (governorate) {
        query = query.eq('governorate', governorate);
      }

      const { data: records, error } = await query;

      if (error) {
        throw error;
      }

      const response: ReviewQueueItem[] = (records || []).map(record => ({
        recordId: record.id,
        name: record.name,
        confidence: record.confidence || 0,
        enrichmentIssues: record.enrichment_issues || [],
        source: record.source,
        phone: record.phone_formatted || record.phone,
        language: record.language,
        governorate: record.governorate,
        city: record.city,
        category: record.category,
      }));

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Error getting review queue:', error);
      return jsonResponse({ error: 'Failed to get review queue' }, 500);
    }
  });

  // POST /api/records/approve - Approve or reject a record
  router.post('/approve', async (request: IttyRequest) => {
    try {
      const body = await request.json?.() as ApproveRecordRequest;

      if (!body.recordId || !body.reviewDecision) {
        return jsonResponse({ error: 'Missing required fields: recordId, reviewDecision' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const updates: Record<string, unknown> = {
        review_status: body.reviewDecision,
        review_notes: body.notes || null,
        reviewed_by: request.headers.get('x-user-id') || 'system',
        updated_at: new Date().toISOString(),
      };

      // If approved, move to next stage
      if (body.reviewDecision === 'APPROVED') {
        updates.pipeline_stage = 'REVIEWED';
      }

      const { data, error } = await supabase
        .from('business_records_staging')
        .update(updates)
        .eq('id', body.recordId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return jsonResponse({
        recordId: body.recordId,
        decision: body.reviewDecision,
        updated: true,
        record: data,
      });

    } catch (error) {
      console.error('[API] Error approving record:', error);
      return jsonResponse({ error: 'Failed to approve record' }, 500);
    }
  });

  // GET /api/records/staging - List staging records with filters
  router.get('/staging', async (request: IttyRequest) => {
    try {
      const url = new URL(request.url || '');
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      let query = supabase
        .from('business_records_staging')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      const governorate = url.searchParams.get('governorate');
      const category = url.searchParams.get('category');
      const phoneCategory = url.searchParams.get('phone_category');
      const language = url.searchParams.get('language');
      const pipelineStage = url.searchParams.get('pipeline_stage');
      const reviewStatus = url.searchParams.get('review_status');

      if (governorate) query = query.eq('governorate', governorate);
      if (category) query = query.eq('category', category);
      if (phoneCategory) query = query.eq('phone_category', phoneCategory);
      if (language) query = query.eq('language', language);
      if (pipelineStage) query = query.eq('pipeline_stage', pipelineStage);
      if (reviewStatus) query = query.eq('review_status', reviewStatus);

      const { data: records, error } = await query;

      if (error) {
        throw error;
      }

      return jsonResponse({
        records: records || [],
        count: records?.length || 0,
      });

    } catch (error) {
      console.error('[API] Error getting staging records:', error);
      return jsonResponse({ error: 'Failed to get staging records' }, 500);
    }
  });

  // GET /api/records/production - List production records
  router.get('/production', async (request: IttyRequest) => {
    try {
      const url = new URL(request.url || '');
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      let query = supabase
        .from('business_records_production')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      const governorate = url.searchParams.get('governorate');
      const category = url.searchParams.get('category');
      const phoneCategory = url.searchParams.get('phone_category');
      const language = url.searchParams.get('language');
      const city = url.searchParams.get('city');

      if (governorate) query = query.eq('governorate', governorate);
      if (category) query = query.eq('category', category);
      if (phoneCategory) query = query.eq('phone_category', phoneCategory);
      if (language) query = query.eq('language', language);
      if (city) query = query.eq('city', city);

      const { data: records, error } = await query;

      if (error) {
        throw error;
      }

      return jsonResponse({
        records: records || [],
        count: records?.length || 0,
      });

    } catch (error) {
      console.error('[API] Error getting production records:', error);
      return jsonResponse({ error: 'Failed to get production records' }, 500);
    }
  });

  // POST /api/records/push - Push staging records to production
  router.post('/push', async (request: IttyRequest) => {
    try {
      const body = await request.json?.() as { jobId?: string; recordIds?: string[] };

      if (!body.jobId && (!body.recordIds || body.recordIds.length === 0)) {
        return jsonResponse({ error: 'Missing required fields: jobId or recordIds' }, 400);
      }

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      let query = supabase
        .from('business_records_staging')
        .select('*')
        .eq('pipeline_stage', 'READY_FOR_PUSH')
        .eq('is_duplicate_candidate', false);

      if (body.jobId) {
        query = query.eq('job_id', body.jobId);
      } else if (body.recordIds) {
        query = query.in('id', body.recordIds);
      }

      const { data: records, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (!records || records.length === 0) {
        return jsonResponse({ error: 'No records ready to push' }, 400);
      }

      // Prepare production records
      const productionRecords = records.map(record => ({
        id: record.id,
        name: record.name,
        name_ar: record.name_ar,
        name_ku: record.name_ku,
        phone: record.phone_formatted,
        has_phone: record.has_phone,
        phone_category: record.phone_category,
        whatsapp: record.whatsapp,
        category: record.category,
        governorate: record.governorate,
        city: record.city,
        address: record.address,
        language: record.language,
        sources: [record.source],
        source_urls: record.source_url ? [record.source_url] : [],
        confidence_final: record.confidence,
        verified_via: record.verified_via || [],
        pushed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));

      // Batch insert
      const { error: insertError } = await supabase
        .from('business_records_production')
        .insert(productionRecords);

      if (insertError) {
        throw insertError;
      }

      // Update staging records
      await supabase
        .from('business_records_staging')
        .update({
          pipeline_stage: 'READY_FOR_PUSH',
          updated_at: new Date().toISOString(),
        })
        .in('id', records.map(r => r.id));

      const response: PushResponse = {
        recordsInserted: productionRecords.length,
        duplicatesSkipped: 0,
      };

      return jsonResponse(response);

    } catch (error) {
      console.error('[API] Error pushing records:', error);
      return jsonResponse({ error: 'Failed to push records' }, 500);
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
