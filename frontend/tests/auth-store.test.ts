import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API module before importing the store
vi.mock('@/api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

// Mock the axios module to capture the registered handler
let capturedHandler: (() => void) | null = null;
vi.mock('@/lib/axios', () => ({
  default: { interceptors: { response: { use: vi.fn() } } },
  setUnauthorizedHandler: vi.fn((handler: (() => void) | null) => {
    capturedHandler = handler;
  }),
}));

import { useAuthStore } from '@/stores/auth';
import { getCurrentUser, login as loginApi, changePassword as changePasswordApi, logout as logoutApi } from '@/api/auth';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLoginApi = vi.mocked(loginApi);
const mockChangePasswordApi = vi.mocked(changePasswordApi);
const mockLogoutApi = vi.mocked(logoutApi);

const ADMIN_USER = {
  id: 1,
  username: 'admin',
  name: '管理员',
  role: 'ADMIN' as const,
  department: { id: 1, name: '技术部' },
  jobTitle: null,
  workEmail: null,
  phone: null,
  status: 'ENABLED' as const,
  mustChangePassword: true,
  isDepartmentManager: false,
  createdAt: '2026-01-01',
};

const EMPLOYEE_USER = {
  id: 2,
  username: 'emp01',
  name: '张三',
  role: 'EMPLOYEE' as const,
  department: { id: 1, name: '技术部' },
  jobTitle: '工程师',
  workEmail: null,
  phone: null,
  status: 'ENABLED' as const,
  mustChangePassword: false,
  isDepartmentManager: false,
  createdAt: '2026-01-01',
};

beforeEach(() => {
  // Reset the store to initial state
  useAuthStore.setState({ user: null, loading: false, initialized: false });
  capturedHandler = null;
  vi.clearAllMocks();
});

describe('initAuth', () => {
  it('should set user and initialized=true when /me succeeds', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(ADMIN_USER);
    expect(state.initialized).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('should set user=null and initialized=true when /me returns 401', async () => {
    mockGetCurrentUser.mockRejectedValue({ response: { status: 401 } });

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.initialized).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('should complete initAuth without throwing on 401', async () => {
    mockGetCurrentUser.mockRejectedValue({ response: { status: 401 } });

    // Should not throw — the catch block handles it
    await expect(useAuthStore.getState().initAuth()).resolves.toBeUndefined();

    expect(useAuthStore.getState().initialized).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('should register the unauthorized handler during initAuth', async () => {
    mockGetCurrentUser.mockRejectedValue({ response: { status: 401 } });

    await useAuthStore.getState().initAuth();

    expect(capturedHandler).toBeTypeOf('function');
  });
});

describe('401 interceptor handler', () => {
  it('should clear user when called after initialization with an active user', async () => {
    useAuthStore.setState({ user: ADMIN_USER, initialized: true });
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().user).toEqual(ADMIN_USER);

    // Simulate a 401 arriving (session expired)
    capturedHandler!();

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('should NOT clear user when called during initialization (user already null)', async () => {
    mockGetCurrentUser.mockRejectedValue({ response: { status: 401 } });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().user).toBeNull();

    // Calling the handler should be a no-op (user is already null)
    capturedHandler!();

    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('changePassword', () => {
  it('should clear user after successful password change (no getCurrentUser call)', async () => {
    useAuthStore.setState({ user: ADMIN_USER, initialized: true });
    mockChangePasswordApi.mockResolvedValue({ message: '密码修改成功，请重新登录' });

    await useAuthStore.getState().changePassword('OldPass123', 'NewPass456');

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    // getCurrentUser should NOT have been called
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockChangePasswordApi).toHaveBeenCalledWith('OldPass123', 'NewPass456');
  });

  it('should propagate error when password change fails', async () => {
    useAuthStore.setState({ user: ADMIN_USER, initialized: true });
    mockChangePasswordApi.mockRejectedValue({
      response: { status: 400, data: { error: { message: '当前密码错误' } } },
    });

    await expect(
      useAuthStore.getState().changePassword('WrongPass', 'NewPass456')
    ).rejects.toThrow();

    // User should NOT be cleared on failure
    expect(useAuthStore.getState().user).toEqual(ADMIN_USER);
  });
});

describe('login', () => {
  it('should set ADMIN user after login', async () => {
    mockLoginApi.mockResolvedValue({ mustChangePassword: true });
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    const result = await useAuthStore.getState().login('admin', 'Admin123');

    expect(result.mustChangePassword).toBe(true);
    expect(useAuthStore.getState().user).toEqual(ADMIN_USER);
  });

  it('should set EMPLOYEE user after login', async () => {
    mockLoginApi.mockResolvedValue({ mustChangePassword: false });
    mockGetCurrentUser.mockResolvedValue(EMPLOYEE_USER);

    const result = await useAuthStore.getState().login('emp01', 'Emp12345');

    expect(result.mustChangePassword).toBe(false);
    expect(useAuthStore.getState().user).toEqual(EMPLOYEE_USER);
    expect(useAuthStore.getState().user?.role).toBe('EMPLOYEE');
  });
});

describe('logout', () => {
  it('should clear user even if logout API fails', async () => {
    useAuthStore.setState({ user: ADMIN_USER, initialized: true });
    mockLogoutApi.mockRejectedValue(new Error('network error'));

    // The error propagates (try/finally without catch), but user is still cleared
    await useAuthStore.getState().logout().catch(() => {});

    expect(useAuthStore.getState().user).toBeNull();
  });
});
