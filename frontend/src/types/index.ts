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

// ---- Leave ----

export interface LeaveRequest {
  id: number;
  leaveType: 'PERSONAL' | 'SICK' | 'ANNUAL';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  stateVersion: number;
  applicant?: { id: number; name: string };
  submittedDepartment?: { id: number; name: string };
  approver?: { id: number; name: string };
  createdAt: string;
  updatedAt?: string;
  finalAction?: {
    action: string;
    operatorName: string;
    comment: string | null;
    createdAt: string;
  };
}

export interface LeaveActionLog {
  id: number;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EDITED' | 'RESUBMITTED';
  operatorId: number;
  operatorName: string;
  comment: string | null;
  stateVersion: number;
  createdAt: string;
}

export interface LeaveDetail extends LeaveRequest {
  actionLogs?: LeaveActionLog[];
  finalAction?: {
    action: string;
    operatorName: string;
    comment: string | null;
    createdAt: string;
  };
}

// ---- Knowledge ----

export interface KnowledgeCategory {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface KnowledgeArticle {
  id: number;
  title: string;
  summary: string | null;
  content?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';
  categoryId: number;
  authorId: number;
  publishedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: number; name: string };
  author?: { id: number; name: string };
}
