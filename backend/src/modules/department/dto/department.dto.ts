import { z } from 'zod';

// ---- Create Department ----
export const createDepartmentSchema = z.object({
  name: z.string().min(1, '部门名称不能为空').max(100, '部门名称最多100字'),
});

export type CreateDepartmentRequest = z.infer<typeof createDepartmentSchema>;

// ---- Update Department ----
export const updateDepartmentSchema = z.object({
  name: z.string().min(1, '部门名称不能为空').max(100, '部门名称最多100字'),
});

export type UpdateDepartmentRequest = z.infer<typeof updateDepartmentSchema>;

// ---- Department Query (list) ----
export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
});

export type DepartmentQuery = z.infer<typeof departmentQuerySchema>;

// ---- Set Manager ----
export const setManagerSchema = z.object({
  userId: z.number().int().positive('请选择负责人'),
});

export type SetManagerRequest = z.infer<typeof setManagerSchema>;

// ---- Manager Candidate Query ----
export const managerCandidateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
});

export type ManagerCandidateQuery = z.infer<typeof managerCandidateQuerySchema>;
