import http from '@/lib/axios';
import type { ApiResponse, User, PaginatedResponse } from '@/types';

export async function getUsers(params?: {
  page?: number; pageSize?: number; keyword?: string;
  role?: string; status?: string; departmentId?: number;
  managerDuty?: string; sortBy?: string; sortOrder?: string;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<User>>>('/users', { params });
  return res.data.data;
}

export async function getUser(id: number) {
  const res = await http.get<ApiResponse<User>>(`/users/${id}`);
  return res.data.data;
}

export async function createUser(data: {
  username: string; initialPassword: string; name: string;
  role: 'ADMIN' | 'EMPLOYEE'; departmentId?: number | null;
  jobTitle?: string; workEmail?: string; phone?: string;
}) {
  const res = await http.post<ApiResponse<User>>('/users', data);
  return res.data.data;
}

export async function updateUser(id: number, data: {
  name?: string; jobTitle?: string | null; workEmail?: string | null; phone?: string | null;
}) {
  const res = await http.patch<ApiResponse<User>>(`/users/${id}`, data);
  return res.data.data;
}

export async function transferDepartment(userId: number, departmentId: number) {
  const res = await http.put<ApiResponse<{ userId: number; departmentId: number }>>(`/users/${userId}/department`, { departmentId });
  return res.data.data;
}

export async function resetPassword(userId: number, newPassword: string) {
  const res = await http.post<ApiResponse<{ message: string }>>(`/users/${userId}/password-reset`, { newPassword });
  return res.data.data;
}

export async function disableUser(userId: number) {
  const res = await http.post<ApiResponse<{ message: string }>>(`/users/${userId}/disable`);
  return res.data.data;
}
