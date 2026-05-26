import { Hono } from 'hono';
import { cors } from './middleware/cors';
import { logger } from './middleware/logger';
import { authRoutes } from './routes/auth';
import { businessRoutes } from './routes/businesses';
import { healthRoutes } from './routes/health';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Global middleware
app.use('*', cors());
app.use('*', logger());

// Routes
app.route('/auth', authRoutes);
app.route('/businesses', businessRoutes);
app.route('/health', healthRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      message: 'Billboard3D API v1.0.0',
      endpoints: {
        auth: '/auth',
        businesses: '/businesses',
        health: '/health'
      }
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  }, 500);
});

export { app };
