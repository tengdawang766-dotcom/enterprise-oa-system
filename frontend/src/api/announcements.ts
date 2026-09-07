import http from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  Announcement,
  AnnouncementListItem,
  AnnouncementDetail,
  EmployeeAnnouncementItem,
  ReadStats,
  ReadRecord,
  UnreadRecord,
} from '@/types';

// ========================
// Admin APIs
// ========================

export async function getAnnouncements(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<AnnouncementListItem>>>('/announcements', { params });
  return res.data.data;
}

export async function getAnnouncement(id: number) {
  const res = await http.get<ApiResponse<AnnouncementDetail>>(`/announcements/${id}`);
  return res.data.data;
}

export async function createAnnouncement(data: { title: string; content: string }) {
  const res = await http.post<ApiResponse<Announcement>>('/announcements', data);
  return res.data.data;
}

export async function updateAnnouncement(id: number, data: { title: string; content: string }) {
  const res = await http.patch<ApiResponse<Announcement>>(`/announcements/${id}`, data);
  return res.data.data;
}

export async function deleteAnnouncement(id: number) {
  await http.delete(`/announcements/${id}`);
}

export async function publishAnnouncement(id: number) {
  const res = await http.post<ApiResponse<Announcement>>(`/announcements/${id}/publish`);
  return res.data.data;
}

export async function withdrawAnnouncement(id: number) {
  const res = await http.post<ApiResponse<Announcement>>(`/announcements/${id}/withdraw`);
  return res.data.data;
}

export async function getReadStats(id: number) {
  const res = await http.get<ApiResponse<ReadStats>>(`/announcements/${id}/read-stats`);
  return res.data.data;
}

export async function getReadList(id: number, params?: { page?: number; pageSize?: number }) {
  const res = await http.get<ApiResponse<PaginatedResponse<ReadRecord>>>(`/announcements/${id}/read-list`, { params });
  return res.data.data;
}

export async function getUnreadList(id: number, params?: { page?: number; pageSize?: number }) {
  const res = await http.get<ApiResponse<PaginatedResponse<UnreadRecord>>>(`/announcements/${id}/unread-list`, { params });
  return res.data.data;
}

// ========================
// Employee APIs
// ========================

export async function getMyAnnouncements(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  readStatus?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<EmployeeAnnouncementItem>>>('/me/announcements', { params });
  return res.data.data;
}

export async function openAnnouncement(id: number) {
  const res = await http.post<ApiResponse<{
    id: number;
    title: string;
    content: string;
    publishedAt: string;
    read: boolean;
    firstReadAt: string | null;
  }>>(`/me/announcements/${id}/open`);
  return res.data.data;
}
