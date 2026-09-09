import http from '@/lib/axios';
import type { ApiResponse, User } from '@/types';

export async function updateContact(workEmail: string | null, phone: string | null) {
  const res = await http.patch<ApiResponse<User>>('/me/contact', { workEmail, phone });
  return res.data.data;
}
