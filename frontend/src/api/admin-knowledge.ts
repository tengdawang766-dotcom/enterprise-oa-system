import http from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  KnowledgeArticle,
  KnowledgeComment,
  AdminKnowledgeCategory,
} from '@/types';

// ========================
// Admin Category APIs
// ========================

export async function getAdminCategories() {
  const res = await http.get<ApiResponse<AdminKnowledgeCategory[]>>('/admin/knowledge/categories');
  return res.data.data;
}

export async function createAdminCategory(data: {
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  const res = await http.post<ApiResponse<AdminKnowledgeCategory>>('/admin/knowledge/categories', data);
  return res.data.data;
}

export async function updateAdminCategory(id: number, data: {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const res = await http.put<ApiResponse<AdminKnowledgeCategory>>(`/admin/knowledge/categories/${id}`, data);
  return res.data.data;
}

// ========================
// Admin Article APIs
// ========================

export async function getAdminArticles(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  status?: string[];
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeArticle>>>('/admin/knowledge/articles', { params });
  return res.data.data;
}

export async function getAdminArticle(id: number) {
  const res = await http.get<ApiResponse<KnowledgeArticle>>(`/admin/knowledge/articles/${id}`);
  return res.data.data;
}

export async function takeDownArticle(id: number, reason: string) {
  const res = await http.post<ApiResponse<void>>(`/admin/knowledge/articles/${id}/take-down`, { reason });
  return res.data.data;
}

export async function approveReview(id: number) {
  const res = await http.post<ApiResponse<void>>(`/admin/knowledge/articles/${id}/review/approve`);
  return res.data.data;
}

export async function rejectReview(id: number, reason: string) {
  const res = await http.post<ApiResponse<void>>(`/admin/knowledge/articles/${id}/review/reject`, { reason });
  return res.data.data;
}

// ========================
// Admin Comment APIs
// ========================

export async function getAdminComments(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeComment>>>('/admin/knowledge/comments', { params });
  return res.data.data;
}

export async function adminDeleteComment(id: number, reason: string) {
  const res = await http.delete<ApiResponse<void>>(`/admin/knowledge/comments/${id}`, { data: { reason } });
  return res.data.data;
}
