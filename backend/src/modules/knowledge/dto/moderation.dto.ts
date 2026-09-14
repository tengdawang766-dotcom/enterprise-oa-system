import { z } from 'zod';

// ---- Admin Article List Query ----
export const adminArticleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100, '搜索关键词最多100个字符').optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z
    .union([z.enum(['PUBLISHED', 'TAKEN_DOWN', 'PENDING_REVIEW']), z.array(z.enum(['PUBLISHED', 'TAKEN_DOWN', 'PENDING_REVIEW']))])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
});

export type AdminArticleQuery = z.infer<typeof adminArticleQuerySchema>;

// ---- Take Down Article ----
export const takeDownSchema = z.object({
  reason: z.string().trim().min(2, '下架原因至少2个字符').max(500, '下架原因最多500个字符'),
});

export type TakeDownRequest = z.infer<typeof takeDownSchema>;

// ---- Reject Review ----
export const rejectReviewSchema = z.object({
  reason: z.string().trim().min(2, '拒绝原因至少2个字符').max(500, '拒绝原因最多500个字符'),
});

export type RejectReviewRequest = z.infer<typeof rejectReviewSchema>;

// ---- Admin Comment List Query ----
export const adminCommentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100, '搜索关键词最多100个字符').optional(),
});

export type AdminCommentQuery = z.infer<typeof adminCommentQuerySchema>;
