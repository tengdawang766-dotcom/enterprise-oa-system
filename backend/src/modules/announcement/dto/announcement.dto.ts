import { z } from 'zod';

// ---- Create Announcement (Draft) ----
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, '公告标题不能为空').max(200, '公告标题最多200字'),
  content: z.string().min(1, '公告内容不能为空'),
});

export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementSchema>;

// ---- Update Announcement (Draft only) ----
export const updateAnnouncementSchema = z.object({
  title: z.string().min(1, '公告标题不能为空').max(200, '公告标题最多200字'),
  content: z.string().min(1, '公告内容不能为空'),
});

export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementSchema>;

// ---- Admin Announcement Query ----
export const adminAnnouncementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'WITHDRAWN']).optional(),
  keyword: z.string().optional(),
});

export type AdminAnnouncementQuery = z.infer<typeof adminAnnouncementQuerySchema>;

// ---- Employee Announcement Query ----
export const employeeAnnouncementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  readStatus: z.enum(['READ', 'UNREAD']).optional(),
});

export type EmployeeAnnouncementQuery = z.infer<typeof employeeAnnouncementQuerySchema>;

// ---- Read list query ----
export const readListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReadListQuery = z.infer<typeof readListQuerySchema>;
