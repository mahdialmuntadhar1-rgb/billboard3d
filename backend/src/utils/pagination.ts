import type { PaginationMeta } from '../types';

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export class PaginationUtils {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  static parseParams(query: Record<string, string>): PaginationParams {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(this.MAX_LIMIT, Math.max(1, parseInt(query.limit || String(this.DEFAULT_LIMIT))));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  static buildMeta(total: number, params: PaginationParams): PaginationMeta {
    const totalPages = Math.ceil(total / params.limit);
    const hasNext = params.page < totalPages;
    const hasPrev = params.page > 1;

    return {
      total,
      page: params.page,
      limit: params.limit,
      hasNext,
      hasPrev
    };
  }

  static buildQuery(params: PaginationParams): string {
    return `LIMIT ? OFFSET ?`;
  }

  static buildParams(params: PaginationParams): [number, number] {
    return [params.limit, params.offset];
  }
}
