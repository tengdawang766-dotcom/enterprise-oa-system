import { z } from 'zod';

// ---- Comment List Query ----
export const commentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CommentQuery = z.infer<typeof commentQuerySchema>;

// ---- Create Comment ----
export const createCommentSchema = z.object({
  content: z.string().trim().min(1, '评论内容不能为空').max(1000, '评论内容最多1000个字符'),
});

export type CreateCommentRequest = z.infer<typeof createCommentSchema>;

// ---- Admin Delete Comment ----
export const adminDeleteCommentSchema = z.object({
  reason: z.string().trim().min(2, '删除原因至少2个字符').max(500, '删除原因最多500个字符'),
});

export type AdminDeleteCommentRequest = z.infer<typeof adminDeleteCommentSchema>;
