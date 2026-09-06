import http from '@/lib/axios';
import type { ApiResponse, User } from '@/types';

export async function login(username: string, password: string) {
  const res = await http.post<ApiResponse<{ user: User; mustChangePassword: boolean }>>('/auth/sessions', { username, password });
  return res.data.data;
}

export async function logout() {
  await http.delete('/auth/session');
}

export async function getCurrentUser() {
  const res = await http.get<ApiResponse<User>>('/me');
  return res.data.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await http.patch<ApiResponse<{ message: string }>>('/me/password', { currentPassword, newPassword });
  return res.data.data;
}
