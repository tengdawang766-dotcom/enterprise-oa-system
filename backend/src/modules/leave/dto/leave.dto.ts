import { z } from 'zod';

// ---- Create Leave Request (submit) ----
export const createLeaveSchema = z.object({
  leaveType: z.enum(['PERSONAL', 'SICK', 'ANNUAL'], {
    errorMap: () => ({ message: '请假类型无效' }),
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  reason: z.string().min(1, '请假缘由不能为空').max(500, '请假缘由最多500字'),
  approverId: z.number().int().positive().optional().nullable(),
});

export type CreateLeaveRequest = z.infer<typeof createLeaveSchema>;

// ---- Edit Leave Request (cancelled only) ----
export const editLeaveSchema = z.object({
  leaveType: z.enum(['PERSONAL', 'SICK', 'ANNUAL'], {
    errorMap: () => ({ message: '请假类型无效' }),
  }).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD').optional(),
  reason: z.string().min(1, '请假缘由不能为空').max(500, '请假缘由最多500字').optional(),
});

export type EditLeaveRequest = z.infer<typeof editLeaveSchema>;

// ---- My Leave List Query ----
export const myLeaveQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  leaveType: z.enum(['PERSONAL', 'SICK', 'ANNUAL']).optional(),
  startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type MyLeaveQuery = z.infer<typeof myLeaveQuerySchema>;

// ---- Approval Tasks Query ----
export const approvalTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
});

export type ApprovalTasksQuery = z.infer<typeof approvalTasksQuerySchema>;

// ---- Approval History Query ----
export const approvalHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
});

export type ApprovalHistoryQuery = z.infer<typeof approvalHistoryQuerySchema>;

// ---- Cancel ----
export const cancelLeaveSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
});

export type CancelLeaveRequest = z.infer<typeof cancelLeaveSchema>;

// ---- Approve ----
export const approveLeaveSchema = z.object({
  comment: z.string().max(500, '审批意见最多500字').optional().nullable(),
  expectedStateVersion: z.number().int().min(0),
});

export type ApproveLeaveRequest = z.infer<typeof approveLeaveSchema>;

// ---- Reject ----
export const rejectLeaveSchema = z.object({
  reason: z.string().min(1, '驳回原因不能为空').max(500, '驳回原因最多500字'),
  expectedStateVersion: z.number().int().min(0),
});

export type RejectLeaveRequest = z.infer<typeof rejectLeaveSchema>;

// ---- Resubmit ----
export const resubmitLeaveSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
});

export type ResubmitLeaveRequest = z.infer<typeof resubmitLeaveSchema>;
