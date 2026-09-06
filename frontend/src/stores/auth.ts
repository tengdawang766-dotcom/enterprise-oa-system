import { create } from 'zustand';
import type { User } from '@/types';
import { getCurrentUser, login as loginApi, logout as logoutApi, changePassword as changePasswordApi } from '@/api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;

  initAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initAuth: async () => {
    set({ loading: true });
    try {
      const user = await getCurrentUser();
      set({ user, initialized: true, loading: false });
    } catch {
      set({ user: null, initialized: true, loading: false });
    }
  },

  login: async (username, password) => {
    const result = await loginApi(username, password);
    // After login, fetch full user profile
    const user = await getCurrentUser();
    set({ user });
    return { mustChangePassword: result.mustChangePassword };
  },

  logout: async () => {
    try {
      await logoutApi();
    } finally {
      set({ user: null });
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    await changePasswordApi(currentPassword, newPassword);
    // After password change, re-fetch user (mustChangePassword should be false now)
    const user = await getCurrentUser();
    set({ user });
  },

  setUser: (user) => set({ user }),
}));
