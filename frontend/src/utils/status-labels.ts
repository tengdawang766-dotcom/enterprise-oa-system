/**
 * Shared status label and color maps.
 * Single source of truth for all leave/announcement status display.
 */

// ── Leave ──────────────────────────────────────────────────────────────

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已撤回',
};

export const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  PERSONAL: '事假',
  SICK: '病假',
  ANNUAL: '年假',
};

// ── Leave Action Log ───────────────────────────────────────────────────

export const LEAVE_ACTION_LABEL: Record<string, string> = {
  SUBMITTED: '提交',
  APPROVED: '通过',
  REJECTED: '驳回',
  CANCELLED: '撤回',
  EDITED: '修改',
  RESUBMITTED: '重新提交',
};

export const LEAVE_ACTION_COLOR: Record<string, string> = {
  SUBMITTED: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
  EDITED: 'orange',
  RESUBMITTED: 'blue',
};

// ── Announcement ───────────────────────────────────────────────────────

export const ANNOUNCEMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  WITHDRAWN: '已撤回',
};

export const ANNOUNCEMENT_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  WITHDRAWN: 'warning',
};

// ── User Status ────────────────────────────────────────────────────────

export const USER_STATUS_LABEL: Record<string, string> = {
  ENABLED: '启用',
  DISABLED: '停用',
};

export const USER_STATUS_COLOR: Record<string, string> = {
  ENABLED: 'success',
  DISABLED: 'default',
};
