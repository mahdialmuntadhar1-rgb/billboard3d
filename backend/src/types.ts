export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export type Variables = {
  userId?: string;
  userRole?: string;
};

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  city: string;
  country: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessInput {
  name: string;
  description: string;
  category: string;
  city: string;
  country: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateBusinessInput {
  name?: string;
  description?: string;
  category?: string;
  city?: string;
  country?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}
