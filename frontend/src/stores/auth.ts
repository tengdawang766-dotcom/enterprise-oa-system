import { create } from 'zustand';
import type { User } from '@/types';
import { getCurrentUser, login as loginApi, logout as logoutApi, changePassword as changePasswordApi } from '@/api/auth';
import { setUnauthorizedHandler } from '@/lib/axios';

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  initAuth: async () => {
    // Register the 401 handler so axios interceptor can clear user on session expiry
    setUnauthorizedHandler(() => {
      const { initialized, user } = get();
      if (initialized && user) {
        set({ user: null });
      }
    });

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

  /**
   * Change password.
   * The backend clears the cookie and invalidates all tokens after password change,
   * so getCurrentUser() would return 401. Instead, we clear local state directly.
   * The caller (PasswordChangePage) shows success and navigates to /login.
   */
  changePassword: async (currentPassword, newPassword) => {
    await changePasswordApi(currentPassword, newPassword);
    // Cookie is already cleared by backend — just clear local state
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));
