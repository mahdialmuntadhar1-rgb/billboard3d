import { Router } from 'itty-router';
import { GovernorateAgent, Env } from './durable_objects/GovernorateAgent';
import { createAgentRouter } from './routes/agents';
import { createJobsRouter } from './routes/jobs';
import { createRecordsRouter } from './routes/records';
import { createExportRouter } from './routes/export';
import { createVerificationRouter, createHealthRouter } from './routes/verification';

// ============================================
// Main Worker Entry Point
// ============================================

// Create main router
const router = Router();

// CORS preflight handler
router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
});

// Mount sub-routers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Log request
    console.log(`[Worker] ${request.method} ${url.pathname}`);

    // Mount API routes
    const agentRouter = createAgentRouter(env);
    const jobsRouter = createJobsRouter(env);
    const recordsRouter = createRecordsRouter(env);
    const exportRouter = createExportRouter(env);
    const verificationRouter = createVerificationRouter(env);
    const healthRouter = createHealthRouter(env);

    // Try each router
    let response: Response | undefined;

    // Health check (highest priority)
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      const healthHandler = healthRouter.routes.find(r => r.route?.test('/api/health'));
      if (healthHandler) {
        return await healthHandler.handler({ ...request, params: {} }, env, ctx);
      }
    }

    // Agent routes
    if (url.pathname.startsWith('/api/agents')) {
      response = await agentRouter.handle(request, env, ctx);
    }

    // Job routes
    if (!response && url.pathname.startsWith('/api/jobs')) {
      response = await jobsRouter.handle(request, env, ctx);
    }

    // Records routes
    if (!response && url.pathname.startsWith('/api/records')) {
      response = await recordsRouter.handle(request, env, ctx);
    }

    // Export routes
    if (!response && url.pathname.startsWith('/api/export')) {
      response = await exportRouter.handle(request, env, ctx);
    }

    // Verification routes
    if (!response && url.pathname.startsWith('/api/verification')) {
      response = await verificationRouter.handle(request, env, ctx);
    }

    // Return response or 404
    if (response) {
      return response;
    }

    // 404 Not Found
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

// ============================================
// Durable Object Export
// ============================================

export { GovernorateAgent };

// ============================================
// Additional Handler Types (for TypeScript)
// ============================================

type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response> | Response;

// Extend Router type to include handle method
declare module 'itty-router' {
  interface Router {
    handle: (request: Request, ...args: unknown[]) => Promise<Response | undefined>;
  }
}
