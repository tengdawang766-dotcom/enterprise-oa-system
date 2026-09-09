import http from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface DashboardAnnouncement {
  id: number;
  title: string;
  publishedAt: string | null;
  read: boolean;
  firstReadAt: string | null;
}

export interface DashboardLeaveStats {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

export interface DashboardRecentLeave {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  createdAt: string;
}

export interface DashboardPendingApproval {
  id: number;
  applicantName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  createdAt: string;
}

export interface DashboardData {
  user: {
    name: string;
    departmentName: string | null;
    isDepartmentManager: boolean;
  };
  unreadAnnouncementCount: number;
  recentAnnouncements: DashboardAnnouncement[];
  myLeaveStats: DashboardLeaveStats;
  recentLeaves: DashboardRecentLeave[];
  pendingApprovalCount?: number;
  recentPendingApprovals?: DashboardPendingApproval[];
}

export async function getDashboard() {
  const res = await http.get<ApiResponse<DashboardData>>('/me/work-overview');
  return res.data.data;
}
