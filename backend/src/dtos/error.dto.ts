// Error DTOs for standardized error responses

export interface ErrorDTO {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ErrorResponseDTO {
  success: false;
  error: ErrorDTO;
}

// Standard error codes
export enum ErrorCode {
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
