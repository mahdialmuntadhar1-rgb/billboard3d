import { Hono } from 'hono';
import { successResponse, errorResponse } from '../utils/response';
import { JWTUtils } from '../utils/jwt';
import { DatabaseClient } from '../db/client';
import type { Bindings, Variables } from '../types';
import type { RegisterRequestDTO, LoginRequestDTO, AuthResponseDTO, MeResponseDTO } from '../dtos/auth.dto';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// POST /auth/register
auth.post('/register', async (c) => {
  try {
    const body: RegisterRequestDTO = await c.req.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password || !name) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Email, password, and name are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Invalid email format');
    }

    // Validate password
    if (password.length < 8) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    const db = new DatabaseClient(c.env.DB);
    
    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return errorResponse(c, 'USER_EXISTS', 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + c.env.JWT_SECRET)
    );
    const hashArray = Array.from(new Uint8Array(passwordHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create user
    const userId = await db.createUser(email, hashHex, 'user');
    if (!userId) {
      return errorResponse(c, 'CREATION_FAILED', 'Failed to create user');
    }

    // Get created user
    const user = await db.getUserById(userId);
    if (!user) {
      return errorResponse(c, 'CREATION_FAILED', 'Failed to retrieve created user');
    }

    // Generate JWT
    JWTUtils.setSecret(c.env.JWT_SECRET);
    const token = await JWTUtils.sign({
      sub: user.id as string,
      email: user.email as string,
      role: user.role as string
    });

    // Return DTO-compliant response
    const response: AuthResponseDTO = {
      success: true,
      data: {
        user: {
          id: user.id as string,
          name: name,
          email: user.email as string,
          role: user.role as string
        },
        token
      }
    };

    return c.json(response, 201);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Registration failed');
  }
});

// POST /auth/login
auth.post('/login', async (c) => {
  try {
    const body: LoginRequestDTO = await c.req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Email and password are required');
    }

    const db = new DatabaseClient(c.env.DB);
    
    // Get user
    const user = await db.getUserByEmail(email);
    if (!user) {
      return errorResponse(c, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verify password
    const passwordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + c.env.JWT_SECRET)
    );
    const hashArray = Array.from(new Uint8Array(passwordHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (user.password_hash !== hashHex) {
      return errorResponse(c, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate JWT
    JWTUtils.setSecret(c.env.JWT_SECRET);
    const token = await JWTUtils.sign({
      sub: user.id as string,
      email: user.email as string,
      role: user.role as string
    });

    // Return DTO-compliant response
    const response: AuthResponseDTO = {
      success: true,
      data: {
        user: {
          id: user.id as string,
          name: (user.name as string) || '',
          email: user.email as string,
          role: user.role as string
        },
        token
      }
    };

    return c.json(response);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Login failed');
  }
});

// GET /auth/me
auth.get('/me', async (c) => {
  try {
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

    const db = new DatabaseClient(c.env.DB);
    const user = await db.getUserById(payload.sub);

    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // Return DTO-compliant response
    const response: MeResponseDTO = {
      success: true,
      data: {
        id: user.id as string,
        email: user.email as string,
        name: user.name as string | undefined,
        role: user.role as string,
        createdAt: user.created_at as string,
        updatedAt: user.updated_at as string
      }
    };

    return c.json(response);
  } catch (error) {
    return errorResponse(c, 'INTERNAL_ERROR', 'Failed to get user profile');
  }
});

export { auth as authRoutes };
