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

// ---- Announcement ----

export interface Announcement {
  id: number;
  title: string;
  content: string;
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';
  publisherId: number;
  publishedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementListItem extends Announcement {
  publisherName?: string;
  readCount?: number;
  totalEmployees?: number;
}

export interface EmployeeAnnouncementItem {
  id: number;
  title: string;
  publishedAt: string | null;
  read: boolean;
  firstReadAt: string | null;
}

export interface AnnouncementDetail extends Announcement {
  publisher?: { id: number; name: string };
}

export interface ReadStats {
  announcementId: number;
  totalEmployees: number;
  readCount: number;
  unreadCount: number;
  readRate: number;
}

export interface ReadRecord {
  userId: number;
  name: string;
  username: string;
  department: { id: number; name: string } | null;
  firstReadAt: string;
}

export interface UnreadRecord {
  userId: number;
  name: string;
  username: string;
  department: { id: number; name: string } | null;
}

// ---- Directory ----

export interface DirectoryItem {
  id: number;
  name: string;
  username: string;
  department: { id: number; name: string } | null;
  jobTitle: string | null;
  workEmail: string | null;
  phone: string | null;
}

export interface DirectoryDepartment {
  id: number;
  name: string;
}
