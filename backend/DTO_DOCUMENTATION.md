# DTO Documentation

This document provides comprehensive documentation for all Data Transfer Objects (DTOs) used in the Billboard3D API. DTOs ensure strict type safety and contract consistency between frontend and backend.

## Table of Contents

- [Common DTOs](#common-dtos)
- [Auth DTOs](#auth-dtos)
- [Business DTOs](#business-dtos)
- [Pagination DTOs](#pagination-dtos)
- [Feed DTOs](#feed-dtos)
- [Error DTOs](#error-dtos)

---

## Common DTOs

### SuccessResponse<T>

Standard success response wrapper used across all endpoints.

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: any;
}
```

### ErrorResponse

Standard error response wrapper.

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

### UserDTO

Standard user object structure.

```typescript
interface UserDTO {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}
```

---

## Auth DTOs

### RegisterRequestDTO

Request body for user registration.

```typescript
interface RegisterRequestDTO {
  email: string;
  password: string;
  name: string;
}
```

**Validation Rules:**
- `email`: Valid email format
- `password`: Minimum 8 characters
- `name`: Required field

### LoginRequestDTO

Request body for user login.

```typescript
interface LoginRequestDTO {
  email: string;
  password: string;
}
```

### AuthResponseDTO

Response format for authentication endpoints (register/login).

```typescript
interface AuthResponseDTO {
  success: true;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    token: string;
  };
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### MeResponseDTO

Response format for current user profile endpoint.

```typescript
interface MeResponseDTO {
  success: true;
  data: {
    id: string;
    email: string;
    name?: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

## Business DTOs

### BusinessDTO

Standard business object structure.

```typescript
interface BusinessDTO {
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
```

**Field Notes:**
- `rating`: 0-5 scale
- `reviewCount`: Total number of reviews
- `isActive`: Boolean flag for active status
- `createdAt`/`updatedAt`: ISO 8601 timestamp strings

### BusinessListResponseDTO

Response format for business list endpoint with pagination.

```typescript
interface BusinessListResponseDTO {
  success: true;
  data: BusinessDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "biz-123",
      "name": "Baghdad Restaurant",
      "description": "Traditional Iraqi cuisine",
      "category": "Restaurant",
      "city": "Baghdad",
      "country": "Iraq",
      "rating": 4.5,
      "reviewCount": 127,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 347,
    "page": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### BusinessDetailResponseDTO

Response format for single business endpoint.

```typescript
interface BusinessDetailResponseDTO {
  success: true;
  data: BusinessDTO;
}
```

### CreateBusinessDTO

Request body for creating a business (admin only).

```typescript
interface CreateBusinessDTO {
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
```

**Required Fields:** `name`, `description`, `category`, `city`, `country`

### UpdateBusinessDTO

Request body for updating a business (admin only).

```typescript
interface UpdateBusinessDTO {
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
```

All fields are optional for partial updates.

---

## Pagination DTOs

### PaginationRequestDTO

Query parameters for paginated requests.

```typescript
interface PaginationRequestDTO {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  city?: string;
  governorate?: string;
}
```

**Default Values:**
- `page`: 1
- `limit`: 20 (max 100)

### PaginationMetaDTO

Pagination metadata in list responses.

```typescript
interface PaginationMetaDTO {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### PaginatedResponseDTO<T>

Generic paginated response wrapper.

```typescript
interface PaginatedResponseDTO<T> {
  success: true;
  data: T[];
  meta: PaginationMetaDTO;
}
```

---

## Feed DTOs

### PostDTO

Social feed post structure for business owners.

```typescript
interface PostDTO {
  id: string;
  userId: string;
  businessId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}
```

**Field Notes:**
- `userId`: ID of the user who created the post
- `businessId`: ID of the associated business
- `imageUrl`: Optional image attachment
- `likesCount`/`commentsCount`: Denormalized counts for performance

### CreatePostDTO

Request body for creating a post (business owner only).

```typescript
interface CreatePostDTO {
  businessId: string;
  content: string;
  imageUrl?: string;
}
```

**Required Fields:** `businessId`, `content`

### PostListResponseDTO

Response format for post list endpoint with pagination.

```typescript
interface PostListResponseDTO {
  success: true;
  data: PostDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}
```

---

## Error DTOs

### ErrorDTO

Standard error object structure.

```typescript
interface ErrorDTO {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

### ErrorResponseDTO

Standard error response wrapper.

```typescript
interface ErrorResponseDTO {
  success: false;
  error: ErrorDTO;
}
```

### Error Codes

Standard error codes used across the API.

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  CREATION_FAILED = 'CREATION_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED'
}
```

**Example Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email, password, and name are required"
  }
}
```

---

## Usage Examples

### Using DTOs in Frontend

```typescript
import type { AuthResponseDTO, BusinessListResponseDTO } from './dtos';

// Type-safe API calls
async function login(email: string, password: string): Promise<AuthResponseDTO> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
}

async function getBusinesses(page: number): Promise<BusinessListResponseDTO> {
  const response = await fetch(`/businesses?page=${page}`);
  return response.json();
}
```

### Using DTOs in Backend

```typescript
import type { RegisterRequestDTO, AuthResponseDTO } from '../dtos';

auth.post('/register', async (c) => {
  const body: RegisterRequestDTO = await c.req.json();
  // ... validation logic
  
  const response: AuthResponseDTO = {
    success: true,
    data: {
      user: { id, name, email, role },
      token
    }
  };
  
  return c.json(response, 201);
});
```

---

## Benefits of DTOs

1. **Type Safety**: Compile-time type checking prevents API contract violations
2. **Documentation**: DTOs serve as living documentation of API contracts
3. **Consistency**: Ensures frontend and backend use identical data structures
4. **Refactoring**: Changes to DTOs propagate to all usages
5. **Validation**: DTOs can include validation rules and constraints
6. **Versioning**: DTOs can be versioned for API evolution

---

## Best Practices

1. **Always use DTOs**: Never use raw types in API responses
2. **Keep DTOs immutable**: DTOs should represent data contracts, not business logic
3. **Document changes**: Update DTO documentation when modifying structures
4. **Version breaking changes**: Use versioning when DTOs change significantly
5. **Validate inputs**: Use DTOs as contracts for request validation
6. **Transform data**: Convert database results to DTOs before sending responses

---

## Migration Guide

If you're updating from the previous API structure:

1. **Update imports**: Change from `../types` to `../dtos`
2. **Update response formats**: Ensure all responses match DTO structures
3. **Add pagination meta**: Include `hasNext` and `hasPrev` in pagination responses
4. **Standardize errors**: Use `ErrorResponseDTO` for all error responses
5. **Transform data**: Convert database field names (snake_case to camelCase)

---

This DTO system ensures perfect alignment between frontend and backend, preventing API contract mismatches and enabling type-safe development.
