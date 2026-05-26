import { Hono } from 'hono';
import { successResponse } from '../utils/response';
import type { Bindings, Variables } from '../types';

const health = new Hono<{ Bindings: Bindings; Variables: Variables }>();

health.get('/', (c) => {
  return successResponse(c, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

health.get('/db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as test').first();
    return successResponse(c, {
      status: 'healthy',
      database: result ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database connection failed'
      }
    }, 500);
  }
});

export { health as healthRoutes };
