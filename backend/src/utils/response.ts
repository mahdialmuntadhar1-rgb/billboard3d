import type { Context } from 'hono';
import type { ApiResponse, PaginationMeta } from '../types';

export const successResponse = <T>(
  c: Context,
  data: T,
  meta?: PaginationMeta,
  status = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta && { meta })
  };
  
  return c.json(response, status);
};

export const errorResponse = (
  c: Context,
  code: string,
  message: string,
  status = 400
) => {
  const response: ApiResponse = {
    success: false,
    error: { code, message }
  };
  
  return c.json(response, status);
};
