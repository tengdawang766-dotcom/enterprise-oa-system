import http from '@/lib/axios';
import type { ApiResponse, Department, PaginatedResponse, ManagerCandidate } from '@/types';

export async function getDepartments(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const res = await http.get<ApiResponse<PaginatedResponse<Department>>>('/departments', { params });
  return res.data.data;
}

export async function getDepartment(id: number) {
  const res = await http.get<ApiResponse<Department>>(`/departments/${id}`);
  return res.data.data;
}

export async function createDepartment(name: string) {
  const res = await http.post<ApiResponse<Department>>('/departments', { name });
  return res.data.data;
}

export async function updateDepartment(id: number, name: string) {
  const res = await http.patch<ApiResponse<Department>>(`/departments/${id}`, { name });
  return res.data.data;
}

export async function deleteDepartment(id: number) {
  await http.delete(`/departments/${id}`);
}

export async function getManagerCandidates(departmentId: number, params?: { page?: number; pageSize?: number; keyword?: string }) {
  const res = await http.get<ApiResponse<PaginatedResponse<ManagerCandidate>>>(`/departments/${departmentId}/manager-candidates`, { params });
  return res.data.data;
}

export async function setManager(departmentId: number, userId: number) {
  const res = await http.put<ApiResponse<{ departmentId: number; managerUserId: number }>>(`/departments/${departmentId}/manager`, { userId });
  return res.data.data;
}

export async function removeManager(departmentId: number) {
  const res = await http.delete<ApiResponse<{ departmentId: number; managerUserId: null }>>(`/departments/${departmentId}/manager`);
  return res.data.data;
}
