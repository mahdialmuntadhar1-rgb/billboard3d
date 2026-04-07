import { Router, Request as IttyRequest } from 'itty-router';
import { SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../durable_objects/GovernorateAgent';
import { exportToCSV, exportToExcel, getFilterOptions } from '../utils/export-handler';
import { ExportFilters } from '../types';

// ============================================
// Export Routes
// ============================================

export function createExportRouter(env: Env): Router {
  const router = Router({ base: '/api/export' });

  // GET /api/export - Export records to CSV or Excel
  router.get('/', async (request: IttyRequest) => {
    try {
      const url = new URL(request.url || '');

      // Parse filters from query params
      const filters: ExportFilters = {};

      const governorate = url.searchParams.get('governorate');
      const category = url.searchParams.get('category');
      const phoneCategory = url.searchParams.get('phone_category');
      const language = url.searchParams.get('language');
      const city = url.searchParams.get('city');

      if (governorate) filters.governorate = governorate;
      if (category) filters.category = category;
      if (phoneCategory) filters.phone_category = phoneCategory as 'whatsapp_only' | 'phone_only' | 'both' | 'none';
      if (language) filters.language = language as 'ar' | 'ku' | 'en';
      if (city) filters.city = city;

      const format = url.searchParams.get('format') || 'csv';

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      if (format === 'csv') {
        const { csv, count, filename } = await exportToCSV(supabase, filters);

        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Record-Count': String(count),
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else if (format === 'excel') {
        const { data, count, filename } = await exportToExcel(supabase, filters);

        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Record-Count': String(count),
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else {
        return jsonResponse({ error: 'Invalid format. Use csv or excel' }, 400);
      }

    } catch (error) {
      console.error('[API] Error exporting records:', error);
      return jsonResponse({ error: 'Failed to export records' }, 500);
    }
  });

  // GET /api/export/filters - Get available filter options
  router.get('/filters', async () => {
    try {
      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const options = await getFilterOptions(supabase);

      return jsonResponse(options);

    } catch (error) {
      console.error('[API] Error getting filter options:', error);
      return jsonResponse({ error: 'Failed to get filter options' }, 500);
    }
  });

  // GET /api/export/logs - Get export history
  router.get('/logs', async (request: IttyRequest) => {
    try {
      const url = new URL(request.url || '');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const supabase = new SupabaseClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: logs, error } = await supabase
        .from('export_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return jsonResponse({
        logs: logs || [],
        count: logs?.length || 0,
      });

    } catch (error) {
      console.error('[API] Error getting export logs:', error);
      return jsonResponse({ error: 'Failed to get export logs' }, 500);
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
