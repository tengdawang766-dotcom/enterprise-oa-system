import http from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  KnowledgeCategory,
  KnowledgeArticle,
} from '@/types';

// ========================
// Category APIs
// ========================

export async function getKnowledgeCategories() {
  const res = await http.get<ApiResponse<KnowledgeCategory[]>>('/knowledge/categories');
  return res.data.data;
}

// ========================
// Public Article APIs
// ========================

export async function getKnowledgeArticles(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeArticle>>>('/knowledge/articles', { params });
  return res.data.data;
}

export async function getKnowledgeArticle(id: number) {
  const res = await http.get<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}`);
  return res.data.data;
}

export async function createKnowledgeArticle(data: {
  title: string;
  summary?: string;
  content: string;
  categoryId: number;
}) {
  const res = await http.post<ApiResponse<KnowledgeArticle>>('/knowledge/articles', data);
  return res.data.data;
}

export async function updateKnowledgeArticle(id: number, data: {
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: number;
}) {
  const res = await http.patch<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}`, data);
  return res.data.data;
}

export async function publishKnowledgeArticle(id: number) {
  const res = await http.post<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}/publish`);
  return res.data.data;
}

export async function withdrawKnowledgeArticle(id: number) {
  const res = await http.post<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}/withdraw`);
  return res.data.data;
}

// ========================
// My Articles APIs
// ========================

export async function getMyKnowledgeArticles(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  status?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeArticle>>>('/knowledge/me/articles', { params });
  return res.data.data;
}
