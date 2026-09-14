import { z } from 'zod';

// ---- AI Draft ----
export const aiDraftSchema = z.object({
  topic: z.string().trim().min(1, '主题不能为空').max(200, '主题最多200个字符'),
  points: z.string().trim().max(2000, '要点最多2000个字符').optional(),
  requirements: z.string().trim().max(2000, '要求最多2000个字符').optional(),
});

export type AiDraftRequest = z.infer<typeof aiDraftSchema>;

// ---- AI Rewrite ----
export const aiRewriteSchema = z.object({
  selectedText: z.string().trim().min(1, '选中文本不能为空').max(12000, '选中文本最多12000个字符'),
  mode: z.enum(['POLISH', 'STRUCTURE']),
});

export type AiRewriteRequest = z.infer<typeof aiRewriteSchema>;

// ---- AI Summary ----
export const aiSummarySchema = z.object({
  content: z.string().trim().min(1, '内容不能为空').max(12000, '内容最多12000个字符'),
});

export type AiSummaryRequest = z.infer<typeof aiSummarySchema>;

// ---- AI Query ----
export const aiQuerySchema = z.object({
  question: z.string().trim().min(1, '问题不能为空').max(500, '问题最多500个字符'),
});

export type AiQueryRequest = z.infer<typeof aiQuerySchema>;
