// Pagination DTOs

export interface PaginationRequestDTO {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  city?: string;
  governorate?: string;
}

export interface PaginationMetaDTO {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponseDTO<T> {
  success: true;
  data: T[];
  meta: PaginationMetaDTO;
}
