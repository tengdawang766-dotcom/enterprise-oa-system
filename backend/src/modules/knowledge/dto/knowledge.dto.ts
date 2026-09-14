import { z } from 'zod';

// ---- Create Article (draft) ----
export const createArticleSchema = z.object({
  title: z.string().trim().min(2, '标题至少2个字符').max(200, '标题最多200个字符'),
  summary: z.string().trim().max(500, '摘要最多500个字符').optional().nullable(),
  content: z.string().trim().min(1, '正文不能为空').max(60000, '正文最多60000个字符'),
  categoryId: z.number().int().positive('分类ID无效'),
});

export type CreateArticleRequest = z.infer<typeof createArticleSchema>;

// ---- Update Article ----
export const updateArticleSchema = z.object({
  title: z.string().trim().min(2, '标题至少2个字符').max(200, '标题最多200个字符').optional(),
  summary: z.string().trim().max(500, '摘要最多500个字符').optional().nullable(),
  content: z.string().trim().min(1, '正文不能为空').max(60000, '正文最多60000个字符').optional(),
  categoryId: z.number().int().positive('分类ID无效').optional(),
});

export type UpdateArticleRequest = z.infer<typeof updateArticleSchema>;

// ---- Public Article List Query ----
export const articleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100, '搜索关键词最多100个字符').optional(),
  categoryId: z.coerce.number().int().positive().optional(),
});

export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;

// ---- My Article List Query (supports status filter) ----
export const myArticleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100, '搜索关键词最多100个字符').optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'WITHDRAWN', 'TAKEN_DOWN', 'PENDING_REVIEW']).optional(),
});

export type MyArticleQuery = z.infer<typeof myArticleQuerySchema>;
