import { z } from 'zod';

// ---- Password validation (shared) ----
const passwordField = z
  .string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

// ---- Create User ----
export const createUserSchema = z.object({
  username: z.string().min(1, '账号不能为空').max(50, '账号最多50字'),
  initialPassword: passwordField,
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50字'),
  role: z.enum(['ADMIN', 'EMPLOYEE'], { message: '角色必须是 ADMIN 或 EMPLOYEE' }),
  departmentId: z.number().int().positive().nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  workEmail: z.string().max(100).email('邮箱格式不正确').nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
}).refine(
  (data) => {
    if (data.role === 'EMPLOYEE' && !data.departmentId) {
      return false;
    }
    if (data.role === 'ADMIN' && data.departmentId != null) {
      return false;
    }
    return true;
  },
  {
    message: '员工必须分配部门，管理员不能分配部门',
    path: ['departmentId'],
  }
);

export type CreateUserRequest = z.infer<typeof createUserSchema>;

// ---- Update User (basic profile only) ----
export const updateUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50字').optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  workEmail: z.string().max(100).email('邮箱格式不正确').nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// ---- Transfer Department ----
export const transferDepartmentSchema = z.object({
  departmentId: z.number().int().positive('目标部门不能为空'),
});

export type TransferDepartmentRequest = z.infer<typeof transferDepartmentSchema>;

// ---- Reset Password ----
export const resetPasswordSchema = z.object({
  newPassword: passwordField,
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

// ---- User Query ----
export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  managerDuty: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'username']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type UserQuery = z.infer<typeof userQuerySchema>;
