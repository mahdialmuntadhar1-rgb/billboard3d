import { Hono } from 'hono';
import { successResponse, errorResponse } from '../utils/response';
import { JWTUtils } from '../utils/jwt';
import { DatabaseClient } from '../db/client';
import { PaginationUtils } from '../utils/pagination';
import type { Bindings, Variables } from '../types';
import type { BusinessDTO, BusinessListResponseDTO, BusinessDetailResponseDTO, CreateBusinessDTO, UpdateBusinessDTO } from '../dtos/business.dto';

const businesses = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Authentication middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const token = JWTUtils.extractFromHeader(authHeader || '');

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
    const businessResults = await db.getBusinesses({
      limit: pagination.limit,
      offset: pagination.offset,
      category: query.category,
      city: query.city,
      search: query.search
    });

    // Get total count
    const countResult = await db.getBusinessesCount({
      category: query.category,
      city: query.city,
      search: query.search
    });
    const total = typeof countResult === 'number' ? countResult : (countResult as any)?.count || 0;

    const meta = PaginationUtils.buildMeta(total, pagination);

    // Transform to DTO format
    const businessDTOs: BusinessDTO[] = businessResults.map((biz: any) => ({
      id: biz.id as string,
      name: biz.name as string,
      description: biz.description as string,
      category: biz.category as string,
      city: biz.city as string,
      country: biz.country as string,
      website: biz.website as string | undefined,
      email: biz.email as string | undefined,
      phone: biz.phone as string | undefined,
      address: biz.address as string | undefined,
      rating: biz.rating as number,
      reviewCount: biz.review_count as number,
      isActive: biz.is_active === 1,
      createdAt: biz.created_at as string,
      updatedAt: biz.updated_at as string
    }));

    // Return DTO-compliant response
    const response: BusinessListResponseDTO = {
      success: true,
      data: businessDTOs,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        hasNext: meta.hasNext,
        hasPrev: meta.hasPrev
      }
    };

    return c.json(response);
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

    // Transform to DTO format
    const businessDTO: BusinessDTO = {
      id: business.id as string,
      name: business.name as string,
      description: business.description as string,
      category: business.category as string,
      city: business.city as string,
      country: business.country as string,
      website: business.website as string | undefined,
      email: business.email as string | undefined,
      phone: business.phone as string | undefined,
      address: business.address as string | undefined,
      rating: business.rating as number,
      reviewCount: business.review_count as number,
      isActive: business.is_active === 1,
      createdAt: business.created_at as string,
      updatedAt: business.updated_at as string
    };

    // Return DTO-compliant response
    const response: BusinessDetailResponseDTO = {
      success: true,
      data: businessDTO
    };

    return c.json(response);
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

    const data: CreateBusinessDTO = await c.req.json();

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

    // Transform to DTO format
    const businessDTO: BusinessDTO = {
      id: business.id as string,
      name: business.name as string,
      description: business.description as string,
      category: business.category as string,
      city: business.city as string,
      country: business.country as string,
      website: business.website as string | undefined,
      email: business.email as string | undefined,
      phone: business.phone as string | undefined,
      address: business.address as string | undefined,
      rating: business.rating as number,
      reviewCount: business.review_count as number,
      isActive: business.is_active === 1,
      createdAt: business.created_at as string,
      updatedAt: business.updated_at as string
    };

    // Return DTO-compliant response
    const response: BusinessDetailResponseDTO = {
      success: true,
      data: businessDTO
    };

    return c.json(response, 201);
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
    const data: UpdateBusinessDTO = await c.req.json();

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

    // Transform to DTO format
    const businessDTO: BusinessDTO = {
      id: updatedBusiness.id as string,
      name: updatedBusiness.name as string,
      description: updatedBusiness.description as string,
      category: updatedBusiness.category as string,
      city: updatedBusiness.city as string,
      country: updatedBusiness.country as string,
      website: updatedBusiness.website as string | undefined,
      email: updatedBusiness.email as string | undefined,
      phone: updatedBusiness.phone as string | undefined,
      address: updatedBusiness.address as string | undefined,
      rating: updatedBusiness.rating as number,
      reviewCount: updatedBusiness.review_count as number,
      isActive: updatedBusiness.is_active === 1,
      createdAt: updatedBusiness.created_at as string,
      updatedAt: updatedBusiness.updated_at as string
    };

    // Return DTO-compliant response
    const response: BusinessDetailResponseDTO = {
      success: true,
      data: businessDTO
    };

    return c.json(response);
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

export { businesses as businessRoutes };
