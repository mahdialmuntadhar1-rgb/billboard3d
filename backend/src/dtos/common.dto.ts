// Common DTOs used across all endpoints

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: any;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export interface UserDTO {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}
