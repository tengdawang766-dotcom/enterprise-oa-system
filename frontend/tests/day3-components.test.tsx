// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Polyfill for antd in jsdom
// ============================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
} as any;

// ============================================================
// Mock axios — hoisted ref
// ============================================================

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mockAxiosGet,
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, name: '测试管理员', role: 'ADMIN', username: 'admin' },
    logout: vi.fn(),
    initAuth: vi.fn(),
    initialized: true,
  }),
}));

// Default response helper — matches backend sendPaginated shape
const emptyPaginated = { data: { success: true, data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } } };
const emptySuccess = { data: { success: true, data: [] } };

beforeEach(() => {
  mockAxiosGet.mockReset();
  mockAxiosGet.mockResolvedValue(emptyPaginated);
});

// ============================================================
// AdminLayout: 管理员布局实际显示通讯录菜单
// ============================================================

describe('AdminLayout 真实组件', () => {
  it('管理员布局实际显示5个菜单项（含通讯录和知识管理）', async () => {
    const { render } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const AdminLayout = (await import('@/layouts/AdminLayout')).default;

    const { container } = render(
      <MemoryRouter initialEntries={['/app/admin/departments']}>
        <AdminLayout />
      </MemoryRouter>
    );

    const menuItems = container.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBe(5);

    const menuTexts = Array.from(menuItems).map(el => el.textContent);
    expect(menuTexts.some(t => t?.includes('部门管理'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('员工管理'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('公告管理'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('通讯录'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('知识管理'))).toBe(true);
  }, 10000);
});

// ============================================================
// EmployeeLayout: 员工布局实际显示公告和通讯录菜单
// ============================================================

describe('EmployeeLayout 真实组件', () => {
  it('员工布局实际显示7个菜单项（含公告、请假、通讯录、知识分享、我的收藏和知识查询）', async () => {
    const { render } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const EmployeeLayout = (await import('@/layouts/EmployeeLayout')).default;

    const { container } = render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <EmployeeLayout />
      </MemoryRouter>
    );

    const menuItems = container.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBe(7);

    const menuTexts = Array.from(menuItems).map(el => el.textContent);
    expect(menuTexts.some(t => t?.includes('工作台'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('公告'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('我的请假'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('通讯录'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('知识分享'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('我的收藏'))).toBe(true);
    expect(menuTexts.some(t => t?.includes('知识查询'))).toBe(true);
  }, 10000);
});

// ============================================================
// DirectoryPage: 通讯录真实渲染
// ============================================================

describe('DirectoryPage 真实组件', () => {
  it('通讯录真实页面渲染标题、搜索框和部门筛选', async () => {
    // Mock departments endpoint
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === '/directory/departments') return Promise.resolve(emptySuccess);
      return Promise.resolve(emptyPaginated);
    });

    const { render, screen } = await import('@testing-library/react');
    const DirectoryPage = (await import('@/pages/DirectoryPage')).default;

    render(<DirectoryPage />);

    expect(screen.getByText('企业通讯录')).toBeTruthy();
    expect(screen.getByPlaceholderText('搜索姓名或账号')).toBeTruthy();
    expect(screen.getByText('搜索')).toBeTruthy();
  });

  it('通讯录空联系方式在真实组件中显示为 -', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === '/directory/departments') return Promise.resolve(emptySuccess);
      if (url === '/directory') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [{
                id: 999, name: '空字段用户', username: 'empty_fields',
                department: null, jobTitle: null, workEmail: null, phone: null,
              }],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            },
          },
        });
      }
      return Promise.resolve(emptyPaginated);
    });

    const { render, screen, waitFor } = await import('@testing-library/react');
    const DirectoryPage = (await import('@/pages/DirectoryPage')).default;

    render(<DirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText('空字段用户')).toBeTruthy();
    });

    // Empty fields show as "-"
    const dashCells = screen.getAllByText('-');
    expect(dashCells.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// AnnouncementListPage: 已读/未读筛选真实触发
// ============================================================

describe('AnnouncementListPage 真实已读筛选', () => {
  it('公告列表包含全部/已读/未读筛选 Radio 按钮', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const AnnouncementListPage = (await import('@/pages/AnnouncementListPage')).default;

    render(
      <MemoryRouter>
        <AnnouncementListPage />
      </MemoryRouter>
    );

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(3);
  });

  it('点击已读筛选触发 readStatus=READ 查询参数', async () => {
    mockAxiosGet.mockResolvedValue(emptyPaginated);

    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const AnnouncementListPage = (await import('@/pages/AnnouncementListPage')).default;

    render(
      <MemoryRouter>
        <AnnouncementListPage />
      </MemoryRouter>
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // "已读"

    await waitFor(() => {
      expect(mockAxiosGet).toHaveBeenCalledWith('/me/announcements', {
        params: expect.objectContaining({ readStatus: 'READ' }),
      });
    });
  });

  it('点击未读筛选触发 readStatus=UNREAD 查询参数', async () => {
    mockAxiosGet.mockResolvedValue(emptyPaginated);

    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const AnnouncementListPage = (await import('@/pages/AnnouncementListPage')).default;

    render(
      <MemoryRouter>
        <AnnouncementListPage />
      </MemoryRouter>
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]); // "未读"

    await waitFor(() => {
      expect(mockAxiosGet).toHaveBeenCalledWith('/me/announcements', {
        params: expect.objectContaining({ readStatus: 'UNREAD' }),
      });
    });
  });
});

// ============================================================
// RoleGuard: 真实权限守卫行为
// ============================================================

describe('RoleGuard 真实组件行为', () => {
  it('管理员角色可以通过 ADMIN RoleGuard', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const RoleGuard = (await import('@/components/guards/RoleGuard')).default;

    render(
      <MemoryRouter>
        <RoleGuard roles={['ADMIN']}>
          <div>Admin Only Content</div>
        </RoleGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Only Content')).toBeTruthy();
  });

  it('管理员角色被 EMPLOYEE RoleGuard 拦截', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const RoleGuard = (await import('@/components/guards/RoleGuard')).default;

    render(
      <MemoryRouter>
        <RoleGuard roles={['EMPLOYEE']}>
          <div>Employee Only Content</div>
        </RoleGuard>
      </MemoryRouter>
    );

    expect(screen.queryByText('Employee Only Content')).toBeNull();
  });
});
