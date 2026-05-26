import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../types';

export const cors = () => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // Set CORS headers
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }

    await next();
  };
};
