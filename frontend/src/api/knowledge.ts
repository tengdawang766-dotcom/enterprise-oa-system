import http from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  KnowledgeCategory,
  KnowledgeArticle,
  KnowledgeComment,
  KnowledgeFavoriteItem,
  AiDraftResponse,
  AiRewriteResponse,
  AiSummaryResponse,
  AiQueryResponse,
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

// ========================
// Comment APIs
// ========================

export async function getComments(articleId: number, page?: number, pageSize?: number) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeComment>>>(
    `/knowledge/articles/${articleId}/comments`,
    { params: { page, pageSize } }
  );
  return res.data.data;
}

export async function createComment(articleId: number, content: string) {
  const res = await http.post<ApiResponse<KnowledgeComment>>(
    `/knowledge/articles/${articleId}/comments`,
    { content }
  );
  return res.data.data;
}

export async function deleteComment(commentId: number) {
  const res = await http.delete<ApiResponse<void>>(`/knowledge/comments/${commentId}`);
  return res.data.data;
}

// ========================
// Like APIs
// ========================

export async function likeArticle(articleId: number) {
  const res = await http.put<ApiResponse<void>>(`/knowledge/articles/${articleId}/like`);
  return res.data.data;
}

export async function unlikeArticle(articleId: number) {
  const res = await http.delete<ApiResponse<void>>(`/knowledge/articles/${articleId}/like`);
  return res.data.data;
}

// ========================
// Favorite APIs
// ========================

export async function favoriteArticle(articleId: number) {
  const res = await http.put<ApiResponse<void>>(`/knowledge/articles/${articleId}/favorite`);
  return res.data.data;
}

export async function unfavoriteArticle(articleId: number) {
  const res = await http.delete<ApiResponse<void>>(`/knowledge/articles/${articleId}/favorite`);
  return res.data.data;
}

export async function getMyFavorites(page?: number, pageSize?: number) {
  const res = await http.get<ApiResponse<PaginatedResponse<KnowledgeFavoriteItem>>>(
    '/knowledge/me/favorites',
    { params: { page, pageSize } }
  );
  return res.data.data;
}

// ========================
// Review API
// ========================

export async function submitReview(articleId: number) {
  const res = await http.post<ApiResponse<void>>(`/knowledge/articles/${articleId}/submit-review`);
  return res.data.data;
}

// ========================
// AI APIs
// ========================

export async function aiDraft(topic: string, points?: string, requirements?: string, signal?: AbortSignal) {
  const res = await http.post<ApiResponse<AiDraftResponse>>('/knowledge/ai/draft', {
    topic,
    points,
    requirements,
  }, { timeout: 120000, signal });
  return res.data.data;
}

export async function aiRewrite(selectedText: string, mode: string, signal?: AbortSignal) {
  const res = await http.post<ApiResponse<AiRewriteResponse>>('/knowledge/ai/rewrite', {
    selectedText,
    mode,
  }, { timeout: 120000, signal });
  return res.data.data;
}

export async function aiSummary(content: string, signal?: AbortSignal) {
  const res = await http.post<ApiResponse<AiSummaryResponse>>('/knowledge/ai/summary', { content }, { timeout: 120000, signal });
  return res.data.data;
}

export async function aiQuery(question: string, signal?: AbortSignal) {
  const res = await http.post<ApiResponse<AiQueryResponse>>('/knowledge/ai/query', { question }, { timeout: 120000, signal });
  return res.data.data;
}
