import http from '@/lib/axios';
import type { ApiResponse, PaginatedResponse, LeaveRequest, LeaveDetail } from '@/types';

// ========================
// Employee Leave APIs
// ========================

export async function createLeave(data: {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  approverId?: number | null;
}) {
  const res = await http.post<ApiResponse<LeaveDetail>>('/leave-requests', data);
  return res.data.data;
}

export async function getMyLeaves(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  leaveType?: string;
  startDateFrom?: string;
  startDateTo?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<LeaveRequest>>>('/me/leave-requests', { params });
  return res.data.data;
}

export async function getMyLeaveDetail(id: number) {
  const res = await http.get<ApiResponse<LeaveDetail>>(`/me/leave-requests/${id}`);
  return res.data.data;
}

export async function cancelLeave(id: number, expectedStateVersion: number) {
  const res = await http.post<ApiResponse<LeaveDetail>>(`/leave-requests/${id}/cancel`, { expectedStateVersion });
  return res.data.data;
}

export async function editLeave(id: number, data: {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}) {
  const res = await http.patch<ApiResponse<LeaveDetail>>(`/leave-requests/${id}`, data);
  return res.data.data;
}

export async function resubmitLeave(id: number, expectedStateVersion: number) {
  const res = await http.post<ApiResponse<LeaveDetail>>(`/leave-requests/${id}/resubmit`, { expectedStateVersion });
  return res.data.data;
}

// ========================
// Approval APIs
// ========================

export async function getApprovalTasks(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<LeaveRequest>>>('/me/approval-tasks', { params });
  return res.data.data;
}

export async function getApprovalHistory(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<LeaveRequest>>>('/me/approval-history', { params });
  return res.data.data;
}

export async function getApprovalDetail(id: number) {
  const res = await http.get<ApiResponse<LeaveDetail>>(`/me/approvals/${id}`);
  return res.data.data;
}

export async function approveLeave(id: number, expectedStateVersion: number, comment?: string) {
  const res = await http.post<ApiResponse<LeaveDetail>>(`/leave-requests/${id}/approve`, { expectedStateVersion, comment });
  return res.data.data;
}

export async function rejectLeave(id: number, expectedStateVersion: number, reason: string) {
  const res = await http.post<ApiResponse<LeaveDetail>>(`/leave-requests/${id}/reject`, { expectedStateVersion, reason });
  return res.data.data;
}
