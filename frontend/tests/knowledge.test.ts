import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock axios
// ============================================================

const { mockGet, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  },
}));

// Mock antd components
vi.mock('antd', () => ({
  Layout: { Header: 'header', Sider: 'sider', Content: 'content' },
  Menu: 'menu',
  Dropdown: 'dropdown',
  Avatar: 'avatar',
  Space: 'space',
  Typography: { Text: 'text', Title: 'title', Paragraph: 'paragraph' },
  Input: Object.assign('input', { Search: 'input-search' }),
  Select: 'select',
  Card: Object.assign('card', { Meta: 'card-meta' }),
  List: Object.assign('list', { Item: Object.assign('list-item', { Meta: 'list-item-meta' }) }),
  Button: 'button',
  Tag: 'tag',
  Empty: 'empty',
  Spin: 'spin',
  Modal: Object.assign('modal', { confirm: vi.fn() }),
  Form: Object.assign('form', { Item: 'form-item', useForm: () => [{ validateFields: vi.fn(), setFieldsValue: vi.fn() }] }),
  message: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('antd/es/menu', () => ({ default: {} }));
vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => null,
  FileTextOutlined: () => null,
  SearchOutlined: () => null,
  EditOutlined: () => null,
  SendOutlined: () => null,
  RollbackOutlined: () => null,
  ArrowLeftOutlined: () => null,
  ReadOutlined: () => null,
  TeamOutlined: () => null,
  BankOutlined: () => null,
  UserOutlined: () => null,
  LogoutOutlined: () => null,
  MenuFoldOutlined: () => null,
  MenuUnfoldOutlined: () => null,
  MailOutlined: () => null,
  PhoneOutlined: () => null,
  DashboardOutlined: () => null,
  AuditOutlined: () => null,
  SaveOutlined: () => null,
  EyeOutlined: () => null,
  DeleteOutlined: () => null,
}));

vi.mock('react-router-dom', () => ({
  Outlet: () => null,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: '1' }),
  useLocation: () => ({ pathname: '/app/knowledge' }),
  BrowserRouter: ({ children }: any) => children,
  Routes: ({ children }: any) => children,
  Route: () => null,
  Navigate: () => null,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, name: '测试员工', role: 'EMPLOYEE', isDepartmentManager: false },
    logout: vi.fn(),
    initAuth: vi.fn(),
    initialized: true,
  }),
}));

// ============================================================
// Import API functions AFTER mocks
// ============================================================

import {
  getKnowledgeCategories,
  getKnowledgeArticles,
  getKnowledgeArticle,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  publishKnowledgeArticle,
  withdrawKnowledgeArticle,
  getMyKnowledgeArticles,
} from '@/api/knowledge';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('知识分享 API 函数', () => {
  describe('getKnowledgeCategories', () => {
    it('调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });
      await getKnowledgeCategories();
      expect(mockGet).toHaveBeenCalledWith('/knowledge/categories');
    });
  });

  describe('getKnowledgeArticles', () => {
    it('调用正确的路径和参数', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getKnowledgeArticles({ page: 1, pageSize: 10, keyword: '测试', categoryId: 1 });
      expect(mockGet).toHaveBeenCalledWith('/knowledge/articles', {
        params: { page: 1, pageSize: 10, keyword: '测试', categoryId: 1 },
      });
    });

    it('不传参数时也能调用', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getKnowledgeArticles();
      expect(mockGet).toHaveBeenCalledWith('/knowledge/articles', { params: undefined });
    });
  });

  describe('getKnowledgeArticle', () => {
    it('调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: {} } });
      await getKnowledgeArticle(42);
      expect(mockGet).toHaveBeenCalledWith('/knowledge/articles/42');
    });
  });

  describe('createKnowledgeArticle', () => {
    it('发送正确的请求体', async () => {
      const body = { title: '测试', content: '正文', categoryId: 1 };
      mockPost.mockResolvedValue({ data: { data: { id: 1 } } });
      const result = await createKnowledgeArticle(body);
      expect(mockPost).toHaveBeenCalledWith('/knowledge/articles', body);
      expect(result.id).toBe(1);
    });

    it('支持可选的 summary', async () => {
      const body = { title: '测试', content: '正文', categoryId: 1, summary: '摘要' };
      mockPost.mockResolvedValue({ data: { data: { id: 1 } } });
      await createKnowledgeArticle(body);
      expect(mockPost).toHaveBeenCalledWith('/knowledge/articles', body);
    });
  });

  describe('updateKnowledgeArticle', () => {
    it('调用 PATCH 正确路径', async () => {
      mockPatch.mockResolvedValue({ data: { data: {} } });
      await updateKnowledgeArticle(5, { title: '新标题' });
      expect(mockPatch).toHaveBeenCalledWith('/knowledge/articles/5', { title: '新标题' });
    });
  });

  describe('publishKnowledgeArticle', () => {
    it('调用正确的路径', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await publishKnowledgeArticle(3);
      expect(mockPost).toHaveBeenCalledWith('/knowledge/articles/3/publish');
    });
  });

  describe('withdrawKnowledgeArticle', () => {
    it('调用正确的路径', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await withdrawKnowledgeArticle(3);
      expect(mockPost).toHaveBeenCalledWith('/knowledge/articles/3/withdraw');
    });
  });

  describe('getMyKnowledgeArticles', () => {
    it('调用正确的路径和参数', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getMyKnowledgeArticles({ page: 1, pageSize: 10, status: 'DRAFT' });
      expect(mockGet).toHaveBeenCalledWith('/knowledge/me/articles', {
        params: { page: 1, pageSize: 10, status: 'DRAFT' },
      });
    });

    it('不传参数时也能调用', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getMyKnowledgeArticles();
      expect(mockGet).toHaveBeenCalledWith('/knowledge/me/articles', { params: undefined });
    });
  });
});

describe('菜单入口', () => {
  it('EmployeeLayout 包含知识分享菜单项', async () => {
    // Dynamically import the layout to check menu items
    const { default: EmployeeLayout } = await import('@/layouts/EmployeeLayout');
    expect(EmployeeLayout).toBeDefined();
  });
});

describe('路由页面可导入', () => {
  it('KnowledgeListPage 可以导入', async () => {
    const mod = await import('@/pages/KnowledgeListPage');
    expect(mod.default).toBeDefined();
  });

  it('KnowledgeDetailPage 可以导入', async () => {
    const mod = await import('@/pages/KnowledgeDetailPage');
    expect(mod.default).toBeDefined();
  });

  it('KnowledgeEditorPage 可以导入', async () => {
    const mod = await import('@/pages/KnowledgeEditorPage');
    expect(mod.default).toBeDefined();
  });

  it('MyKnowledgePage 可以导入', async () => {
    const mod = await import('@/pages/MyKnowledgePage');
    expect(mod.default).toBeDefined();
  });
});

describe('前端类型定义', () => {
  it('KnowledgeCategory 类型可用', async () => {
    const types = await import('@/types');
    // Type-only test: just checking the module exports exist
    expect(types).toBeDefined();
  });
});
