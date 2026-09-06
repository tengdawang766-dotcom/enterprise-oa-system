export interface User {
  id: number;
  username: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  department: { id: number; name: string } | null;
  jobTitle: string | null;
  workEmail: string | null;
  phone: string | null;
  status: 'ENABLED' | 'DISABLED';
  mustChangePassword: boolean;
  isDepartmentManager: boolean;
  createdAt: string;
}

export interface Department {
  id: number;
  name: string;
  manager: { id: number; name: string } | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Array<{ field: string; message: string }>;
  };
}

export interface ManagerCandidate {
  id: number;
  name: string;
  jobTitle: string | null;
}
