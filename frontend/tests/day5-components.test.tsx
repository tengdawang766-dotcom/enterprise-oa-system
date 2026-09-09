// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const { mockAxiosGet, mockAxiosPatch, storeState } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPatch: vi.fn(),
  storeState: { currentUser: null as any, setUserCalls: [] as any[] },
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mockAxiosGet,
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    patch: mockAxiosPatch,
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: storeState.currentUser,
    setUser: (u: any) => { storeState.currentUser = u; storeState.setUserCalls.push(u); },
    logout: vi.fn(),
    initAuth: vi.fn(),
    initialized: true,
  }),
}));

const U = {
  id: 1, name: '张三', username: 'zhangsan', role: 'EMPLOYEE' as const,
  department: { id: 1, name: '技术部' }, jobTitle: '前端工程师',
  workEmail: 'zhangsan@test.com', phone: '13800138001',
  status: 'ENABLED' as const, mustChangePassword: false,
  isDepartmentManager: false, createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  mockAxiosGet.mockReset();
  mockAxiosPatch.mockReset();
  storeState.setUserCalls = [];
  storeState.currentUser = { ...U };
  mockAxiosGet.mockResolvedValue({ data: { success: true, data: { ...U } } });
  mockAxiosPatch.mockResolvedValue({ data: { success: true, data: { ...U } } });
});

afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});

describe('ProfilePage', () => {
  it('shows readonly profile data', async () => {
    const { render, screen, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy(), { timeout: 10000 });
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('zhangsan')).toBeTruthy();
    expect(screen.getByText('前端工程师')).toBeTruthy();
    expect(screen.getByText('技术部')).toBeTruthy();
    expect(screen.getByText('13800138001')).toBeTruthy();
  }, 15000);

  it('shows - for null fields', async () => {
    const nullUser = { ...U, workEmail: null, phone: null, jobTitle: null };
    storeState.currentUser = { ...nullUser };
    mockAxiosGet.mockResolvedValue({ data: { success: true, data: nullUser } });
    const { render } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    const { container } = render(<P />);
    // AntD Descriptions needs time in jsdom
    await new Promise(r => setTimeout(r, 3000));
    const items = container.querySelectorAll('.ant-descriptions-item-content');
    const texts = Array.from(items).map(el => el.textContent?.trim());
    expect(texts.filter(t => t === '-').length).toBeGreaterThanOrEqual(3);
    expect(texts).toContain('张三');
    expect(texts).toContain('zhangsan');
  }, 15000);

  it('edit form prefills correctly', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy());
    fireEvent.click(screen.getByText('编辑联系方式'));
    expect((screen.getByPlaceholderText('请输入工作邮箱') as HTMLInputElement).value).toBe('zhangsan@test.com');
    expect((screen.getByPlaceholderText('请输入联系电话') as HTMLInputElement).value).toBe('13800138001');
  });

  it('validates email format', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy());
    fireEvent.click(screen.getByText('编辑联系方式'));
    fireEvent.change(screen.getByPlaceholderText('请输入工作邮箱'), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(screen.getByText('请输入正确的邮箱格式')).toBeTruthy());
    expect(mockAxiosPatch).not.toHaveBeenCalled();
  });

  it('saves and updates store', async () => {
    const updated = { ...U, workEmail: 'saved@test.com', phone: '13999999999' };
    mockAxiosPatch.mockResolvedValue({ data: { success: true, data: updated } });
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy());
    fireEvent.click(screen.getByText('编辑联系方式'));
    fireEvent.change(screen.getByPlaceholderText('请输入工作邮箱'), { target: { value: 'saved@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('请输入联系电话'), { target: { value: '13999999999' } });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(screen.getByText('联系方式更新成功')).toBeTruthy());
    expect(storeState.setUserCalls.length).toBeGreaterThan(0);
  });

  it('preserves input on save failure', async () => {
    mockAxiosPatch.mockRejectedValue({ response: { data: { error: { message: '保存失败' } } } });
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy());
    fireEvent.click(screen.getByText('编辑联系方式'));
    fireEvent.change(screen.getByPlaceholderText('请输入工作邮箱'), { target: { value: 'fail@test.com' } });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(screen.getByText('保存失败')).toBeTruthy());
    expect((screen.getByPlaceholderText('请输入工作邮箱') as HTMLInputElement).value).toBe('fail@test.com');
  });

  it('non-editable fields are disabled in edit mode', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const P = (await import('@/pages/ProfilePage')).default;
    render(<P />);
    await waitFor(() => expect(screen.getByText('zhangsan@test.com')).toBeTruthy());
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('zhangsan')).toBeTruthy();
    fireEvent.click(screen.getByText('编辑联系方式'));
    const disabled = Array.from(document.querySelectorAll('input')).filter(i => i.disabled);
    expect(disabled.length).toBeGreaterThanOrEqual(5);
    const vals = disabled.map(i => i.value);
    expect(vals).toContain('张三');
    expect(vals).toContain('zhangsan');
    expect(vals).toContain('前端工程师');
    expect(vals).toContain('技术部');
  });
});

const D = {
  user: { name: '张三', departmentName: '技术部', isDepartmentManager: false },
  unreadAnnouncementCount: 3,
  recentAnnouncements: [
    { id: 1, title: '公告一', publishedAt: '2026-09-01T10:00:00Z', read: false, firstReadAt: null },
    { id: 2, title: '公告二', publishedAt: '2026-09-02T10:00:00Z', read: true, firstReadAt: '2026-09-02T12:00:00Z' },
  ],
  myLeaveStats: { pending: 1, approved: 2, rejected: 1, cancelled: 0 },
  recentLeaves: [
    { id: 1, leaveType: 'PERSONAL', startDate: '2026-10-01', endDate: '2026-10-03', days: 3, status: 'PENDING', createdAt: '2026-09-01T10:00:00Z' },
    { id: 2, leaveType: 'ANNUAL', startDate: '2026-08-01', endDate: '2026-08-05', days: 5, status: 'APPROVED', createdAt: '2026-08-01T10:00:00Z' },
  ],
};

const DM = {
  ...D,
  user: { name: '李四', departmentName: '技术部', isDepartmentManager: true },
  pendingApprovalCount: 2,
  recentPendingApprovals: [
    { id: 10, applicantName: '王五', leaveType: 'SICK', startDate: '2026-09-10', endDate: '2026-09-10', days: 1, reason: '看病', createdAt: '2026-09-10T10:00:00Z' },
  ],
};

async function rd(data = D) {
  mockAxiosGet.mockResolvedValue({ data: { success: true, data } });
  const { render, screen, waitFor } = await import('@testing-library/react');
  const { MemoryRouter } = await import('react-router-dom');
  const Dash = (await import('@/pages/EmployeeDashboardPage')).default;
  render(<MemoryRouter><Dash /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(`欢迎回来，${data.user.name}`)).toBeTruthy(), { timeout: 10000 });
  return { screen };
}

describe('Dashboard', () => {
  it('loads stats', async () => {
    const { screen } = await rd();
    expect(screen.getByText('未读公告')).toBeTruthy();
    expect(screen.getByText('我的待审批')).toBeTruthy();
    expect(screen.getByText('已通过请假')).toBeTruthy();
    expect(screen.getByText('已驳回请假')).toBeTruthy();
  });

  it('renders announcements and leaves', async () => {
    const { screen } = await rd();
    expect(screen.getByText('公告一')).toBeTruthy();
    expect(screen.getByText('未读')).toBeTruthy();
    expect(screen.getByText('已读')).toBeTruthy();
    expect(screen.getByText('事假')).toBeTruthy();
    expect(screen.getByText('待审批')).toBeTruthy();
  });

  it('empty state', async () => {
    mockAxiosGet.mockResolvedValue({
      data: { success: true, data: { ...D, unreadAnnouncementCount: 0, recentAnnouncements: [], myLeaveStats: { pending: 0, approved: 0, rejected: 0, cancelled: 0 }, recentLeaves: [] } },
    });
    const { render, screen, waitFor } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const Dash = (await import('@/pages/EmployeeDashboardPage')).default;
    render(<MemoryRouter><Dash /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('暂无公告')).toBeTruthy(), { timeout: 10000 });
    expect(screen.getByText('暂无请假记录')).toBeTruthy();
  });

  it('error and retry', async () => {
    mockAxiosGet.mockRejectedValueOnce({ response: { data: { error: { message: 'err' } } } });
    const { render, screen, waitFor, fireEvent } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const Dash = (await import('@/pages/EmployeeDashboardPage')).default;
    render(<MemoryRouter><Dash /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy(), { timeout: 10000 });
    mockAxiosGet.mockResolvedValue({ data: { success: true, data: D } });
    fireEvent.click(screen.getByText('重试'));
    await waitFor(() => expect(screen.getByText('欢迎回来，张三')).toBeTruthy(), { timeout: 10000 });
  });

  it('no manager section for employee', async () => {
    const { screen } = await rd();
    expect(screen.queryByText('进入审批')).toBeNull();
    expect(screen.queryAllByText('待我审批').length).toBe(0);
  });

  it('quick action buttons', async () => {
    const { screen } = await rd();
    expect(screen.getByText('常用入口')).toBeTruthy();
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent);
    expect(btns.some(t => t?.includes('新建请假'))).toBe(true);
    expect(btns.some(t => t?.includes('我的请假'))).toBe(true);
    expect(btns.some(t => t?.includes('通讯录'))).toBe(true);
  });
});

describe('Manager Dashboard', () => {
  it('shows approval section', async () => {
    const { screen } = await rd(DM);
    expect(screen.getByText('进入审批')).toBeTruthy();
    expect(screen.getAllByText('待我审批').length).toBeGreaterThanOrEqual(1);
  });
});
