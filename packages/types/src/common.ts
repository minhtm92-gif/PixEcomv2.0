// Common types shared across all apps

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export type SortOrder = 'asc' | 'desc';

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}
