import http from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  DirectoryItem,
  DirectoryDepartment,
} from '@/types';

export async function getDirectory(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  departmentId?: number;
}) {
  const res = await http.get<ApiResponse<PaginatedResponse<DirectoryItem>>>('/directory', { params });
  return res.data.data;
}

export async function getDirectoryDetail(id: number) {
  const res = await http.get<ApiResponse<DirectoryItem>>(`/directory/${id}`);
  return res.data.data;
}

export async function getDirectoryDepartments() {
  const res = await http.get<ApiResponse<DirectoryDepartment[]>>('/directory/departments');
  return res.data.data;
}
