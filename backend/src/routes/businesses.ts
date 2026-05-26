import { Hono } from 'hono';
import { successResponse, errorResponse } from '../utils/response';
import { JWTUtils } from '../utils/jwt';
import { DatabaseClient } from '../db/client';
import { PaginationUtils } from '../utils/pagination';
import type { Bindings, Variables } from '../types';

const businesses = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Authentication middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const token = JWTUtils.extractFromHeader(authHeader);

  if (!token) {
    return errorResponse(c, 'UNAUTHORIZED', 'Authorization token required', 401);
  }

  JWTUtils.setSecret(c.env.JWT_SECRET);
  const payload = await JWTUtils.verify(token);

  if (!payload) {
    return errorResponse(c, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  c.set('userId', payload.sub);
  c.set('userRole', payload.role);
  await next();
};

// GET /businesses
businesses.get('/', async (c) => {
  try {
    const query = c.req.query();
    const pagination = PaginationUtils.parseParams(query);

    const db = new DatabaseClient(c.env.DB);
    
    // Get businesses
    const businesses = await db.getBusinesses({
      limit: pagination.limit,
      offset: pagination.offset,
      category: query.category,
      city: query.city,
      search: query.search
    });

    // Get total count
    const total = await db.getBusinessesCount({
      category: query.category,
      city: query.city,
      search: query.search
    });

    const meta = PaginationUtils.buildMeta(total, pagination);

    return successResponse(c, businesses, meta);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to fetch businesses');
  }
});

// GET /businesses/:id
businesses.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    if (!id) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Business ID is required');
    }

    const db = new DatabaseClient(c.env.DB);
    const business = await db.getBusinessById(id);

    if (!business) {
      return errorResponse(c, 'NOT_FOUND', 'Business not found', 404);
    }

    return successResponse(c, business);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to fetch business');
  }
});

// POST /businesses (protected)
businesses.post('/', authMiddleware, async (c) => {
  try {
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return errorResponse(c, 'FORBIDDEN', 'Admin access required', 403);
    }

    const data = await c.req.json();

    // Validate required fields
    if (!data.name || !data.description || !data.category || !data.city || !data.country) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Name, description, category, city, and country are required');
    }

    const db = new DatabaseClient(c.env.DB);
    const businessId = await db.createBusiness(data);

    if (!businessId) {
      return errorResponse(c, 'CREATION_FAILED', 'Failed to create business');
    }

    // Get created business
    const business = await db.getBusinessById(businessId);
    if (!business) {
      return errorResponse(c, 'CREATION_FAILED', 'Failed to retrieve created business');
    }

    return successResponse(c, business, undefined, 201);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to create business');
  }
});

// PUT /businesses/:id (protected)
businesses.put('/:id', authMiddleware, async (c) => {
  try {
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return errorResponse(c, 'FORBIDDEN', 'Admin access required', 403);
    }

    const id = c.req.param('id');
    const data = await c.req.json();

    if (!id) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Business ID is required');
    }

    const db = new DatabaseClient(c.env.DB);
    
    // Check if business exists
    const existingBusiness = await db.getBusinessById(id);
    if (!existingBusiness) {
      return errorResponse(c, 'NOT_FOUND', 'Business not found', 404);
    }

    // Update business
    const success = await db.updateBusiness(id, data);
    if (!success) {
      return errorResponse(c, 'UPDATE_FAILED', 'Failed to update business');
    }

    // Get updated business
    const updatedBusiness = await db.getBusinessById(id);
    if (!updatedBusiness) {
      return errorResponse(c, 'UPDATE_FAILED', 'Failed to retrieve updated business');
    }

    return successResponse(c, updatedBusiness);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to update business');
  }
});

// DELETE /businesses/:id (protected)
businesses.delete('/:id', authMiddleware, async (c) => {
  try {
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return errorResponse(c, 'FORBIDDEN', 'Admin access required', 403);
    }

    const id = c.req.param('id');
    
    if (!id) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Business ID is required');
    }

    const db = new DatabaseClient(c.env.DB);
    
    // Check if business exists
    const existingBusiness = await db.getBusinessById(id);
    if (!existingBusiness) {
      return errorResponse(c, 'NOT_FOUND', 'Business not found', 404);
    }

    // Delete business
    const success = await db.deleteBusiness(id);
    if (!success) {
      return errorResponse(c, 'DELETE_FAILED', 'Failed to delete business');
    }

    return successResponse(c, {
      message: 'Business deleted successfully'
    });
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to delete business');
  }
});

export { businesses };
