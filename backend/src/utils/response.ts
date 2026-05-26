import type { Context } from 'hono';
import type { SuccessResponse } from '../dtos/common.dto';
import type { ErrorResponseDTO, ErrorDTO } from '../dtos/error.dto';
import type { PaginationMetaDTO } from '../dtos/pagination.dto';

export const successResponse = <T>(
  c: Context,
  data: T,
  meta?: PaginationMetaDTO,
  status = 200
) => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta })
  };
  
  return c.json(response, status as any);
};

export const errorResponse = (
  c: Context,
  code: string,
  message: string,
  status = 400,
  details?: Record<string, any>
) => {
  const error: ErrorDTO = { code, message, ...(details && { details }) };
  const response: ErrorResponseDTO = {
    success: false,
    error
  };
  
  return c.json(response, status as any);
};
