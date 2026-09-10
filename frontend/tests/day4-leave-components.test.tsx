// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Polyfill for antd in jsdom
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

// Hoisted mocks
const {
  _authRef, mockGetMyLeaves, mockGetMyLeaveDetail, mockCancelLeave,
  mockResubmitLeave, mockCreateLeave, mockEditLeave,
  mockGetApprovalTasks, mockGetApprovalHistory, mockGetApprovalDetail,
  mockApproveLeave, mockRejectLeave,
} = vi.hoisted(() => ({
  _authRef: { user: null as any },
  mockGetMyLeaves: vi.fn(),
  mockGetMyLeaveDetail: vi.fn(),
  mockCancelLeave: vi.fn(),
  mockResubmitLeave: vi.fn(),
  mockCreateLeave: vi.fn(),
  mockEditLeave: vi.fn(),
  mockGetApprovalTasks: vi.fn(),
  mockGetApprovalHistory: vi.fn(),
  mockGetApprovalDetail: vi.fn(),
  mockApproveLeave: vi.fn(),
  mockRejectLeave: vi.fn(),
}));

vi.mock('@/api/leave', () => ({
  getMyLeaves: (...a: any[]) => mockGetMyLeaves(...a),
  getMyLeaveDetail: (...a: any[]) => mockGetMyLeaveDetail(...a),
  cancelLeave: (...a: any[]) => mockCancelLeave(...a),
  resubmitLeave: (...a: any[]) => mockResubmitLeave(...a),
  createLeave: (...a: any[]) => mockCreateLeave(...a),
  editLeave: (...a: any[]) => mockEditLeave(...a),
  getApprovalTasks: (...a: any[]) => mockGetApprovalTasks(...a),
  getApprovalHistory: (...a: any[]) => mockGetApprovalHistory(...a),
  getApprovalDetail: (...a: any[]) => mockGetApprovalDetail(...a),
  approveLeave: (...a: any[]) => mockApproveLeave(...a),
  rejectLeave: (...a: any[]) => mockRejectLeave(...a),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: _authRef.user,
    loading: false,
    initialized: true,
    initAuth: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    setUser: vi.fn(),
  }),
}));

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setUnauthorizedHandler: vi.fn(),
}));

import LeaveFormPage from '@/pages/LeaveFormPage';
import MyLeaveListPage from '@/pages/MyLeaveListPage';
import ApprovalPage from '@/pages/ApprovalPage';
import EmployeeLayout from '@/layouts/EmployeeLayout';

// ============================================================
// Helpers
// ============================================================

const MANAGER_USER = {
  id: 1, username: 'mgr', name: '负责人', role: 'EMPLOYEE' as const,
  department: { id: 1, name: '技术部' }, jobTitle: null, workEmail: null, phone: null,
  status: 'ENABLED' as const, mustChangePassword: false, isDepartmentManager: true, createdAt: '',
};

const EMPLOYEE_USER = {
  id: 2, username: 'emp', name: '员工', role: 'EMPLOYEE' as const,
  department: { id: 1, name: '技术部' }, jobTitle: null, workEmail: null, phone: null,
  status: 'ENABLED' as const, mustChangePassword: false, isDepartmentManager: false, createdAt: '',
};

const emptyPaginated = { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };

function makeLeave(overrides: any = {}) {
  return {
    id: 1, leaveType: 'PERSONAL', startDate: '2026-09-10', endDate: '2026-09-12',
    days: 3, reason: '个人事务', status: 'PENDING', stateVersion: 0,
    applicant: { id: 2, name: '员工' },
    submittedDepartment: { id: 1, name: '技术部' },
    approver: { id: 1, name: '负责人' },
    createdAt: '2026-09-09T10:00:00Z',
    ...overrides,
  };
}

const ALL_API_MOCKS = [
  mockGetMyLeaves, mockGetMyLeaveDetail, mockCancelLeave,
  mockResubmitLeave, mockCreateLeave, mockEditLeave,
  mockGetApprovalTasks, mockGetApprovalHistory, mockGetApprovalDetail,
  mockApproveLeave, mockRejectLeave,
];

// ============================================================
// Tests
// ============================================================

describe('LeaveFormPage', () => {
  beforeEach(() => {
    ALL_API_MOCKS.forEach(m => m.mockReset());
    _authRef.user = EMPLOYEE_USER;
  });

  it('renders form with required fields', async () => {
    render(
      <MemoryRouter initialEntries={['/app/leave/new']}>
        <LeaveFormPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('提交请假申请')).toBeTruthy();
    });
    expect(screen.getByText('请假类型')).toBeTruthy();
    expect(screen.getByText('开始日期')).toBeTruthy();
    expect(screen.getByText('结束日期')).toBeTruthy();
    expect(screen.getByText('请假事由')).toBeTruthy();
    expect(screen.getByText('提交申请')).toBeTruthy();
  }, 10000);
});

describe('MyLeaveListPage', () => {
  beforeEach(() => {
    ALL_API_MOCKS.forEach(m => m.mockReset());
    _authRef.user = EMPLOYEE_USER;
    mockGetMyLeaves.mockResolvedValue(emptyPaginated);
  });

  it('renders list with data', async () => {
    mockGetMyLeaves.mockResolvedValueOnce({
      items: [makeLeave()],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('我的请假')).toBeTruthy();
      expect(screen.getByText('新建请假')).toBeTruthy();
    });
  });

  it('renders empty state', async () => {
    render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('暂无请假记录')).toBeTruthy();
    });
  });

  it('shows cancel for PENDING', async () => {
    mockGetMyLeaves.mockResolvedValueOnce({
      items: [makeLeave({ status: 'PENDING' })],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('撤回')).toBeTruthy();
    });
  });

  it('shows edit and resubmit for CANCELLED', async () => {
    mockGetMyLeaves.mockResolvedValueOnce({
      items: [makeLeave({ id: 99, status: 'CANCELLED', stateVersion: 1 })],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('编辑')).toBeTruthy();
      expect(screen.getByText('重新提交')).toBeTruthy();
    });
  });

  it('no actions for APPROVED except view', async () => {
    mockGetMyLeaves.mockResolvedValueOnce({
      items: [makeLeave({ id: 88, status: 'APPROVED', stateVersion: 1 })],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    const { container } = render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      const buttons = container.querySelectorAll('button');
      const texts = Array.from(buttons).map(b => b.textContent);
      expect(texts.some(t => t?.includes('查看'))).toBe(true);
      expect(texts.some(t => t === '撤回')).toBe(false);
      expect(texts.some(t => t === '编辑')).toBe(false);
    });
  });

  it('calls correct API', async () => {
    render(<MemoryRouter initialEntries={['/app/leave']}><MyLeaveListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(mockGetMyLeaves).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));
    });
  });
});

describe('ApprovalPage', () => {
  beforeEach(() => {
    ALL_API_MOCKS.forEach(m => m.mockReset());
    mockGetApprovalTasks.mockResolvedValue(emptyPaginated);
    mockGetApprovalHistory.mockResolvedValue(emptyPaginated);
  });

  it('blocks non-manager', () => {
    _authRef.user = EMPLOYEE_USER;
    render(<MemoryRouter initialEntries={['/app/approvals']}><ApprovalPage /></MemoryRouter>);
    expect(screen.getByText('无权限')).toBeTruthy();
  });

  it('allows manager', async () => {
    _authRef.user = MANAGER_USER;
    render(<MemoryRouter initialEntries={['/app/approvals']}><ApprovalPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('审批管理')).toBeTruthy();
      expect(screen.getAllByText('待审批').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('审批历史')).toBeTruthy();
    });
  });

  it('shows approve/reject for pending', async () => {
    _authRef.user = MANAGER_USER;
    mockGetApprovalTasks.mockResolvedValue({
      items: [makeLeave({ applicant: { id: 5, name: '员工A' } })],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    render(<MemoryRouter initialEntries={['/app/approvals']}><ApprovalPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('通过')).toBeTruthy();
      expect(screen.getByText('驳回')).toBeTruthy();
    });
  });

  it('calls approval APIs', async () => {
    _authRef.user = MANAGER_USER;
    render(<MemoryRouter initialEntries={['/app/approvals']}><ApprovalPage /></MemoryRouter>);
    await waitFor(() => {
      expect(mockGetApprovalTasks).toHaveBeenCalled();
      expect(mockGetApprovalHistory).toHaveBeenCalled();
    });
  });
});

describe('EmployeeLayout menu', () => {
  beforeEach(() => {
    ALL_API_MOCKS.forEach(m => m.mockReset());
  });

  afterEach(() => {
    cleanup();
  });

  it('shows approval menu for manager', async () => {
    _authRef.user = MANAGER_USER;
    render(<MemoryRouter initialEntries={['/app/dashboard']}><EmployeeLayout /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('请假审批')).toBeTruthy();
    });
  });

  it('hides approval menu for non-manager', async () => {
    _authRef.user = EMPLOYEE_USER;
    render(<MemoryRouter initialEntries={['/app/dashboard']}><EmployeeLayout /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.queryByText('请假审批')).toBeNull();
      expect(screen.getByText('我的请假')).toBeTruthy();
    });
  });
});
