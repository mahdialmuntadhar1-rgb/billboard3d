import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../types';

export const logger = () => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    // Log request
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      duration: `${duration}ms`,
      ip
    }));
  };
};
