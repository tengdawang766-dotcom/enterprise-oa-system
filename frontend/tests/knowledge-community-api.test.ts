import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock axios
// ============================================================

const { mockGet, mockPost, mockPatch, mockDelete, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
    put: mockPut,
  },
}));

// Mock antd
vi.mock('antd', () => ({
  Layout: { Header: 'header', Sider: 'sider', Content: 'content' },
  Menu: 'menu',
  Dropdown: 'dropdown',
  Avatar: 'avatar',
  Space: 'space',
  Typography: { Text: 'text', Title: 'title', Paragraph: 'paragraph' },
  Input: Object.assign('input', { Search: 'input-search', TextArea: 'textarea' }),
  Select: Object.assign('select', { Option: 'option' }),
  Card: Object.assign('card', { Meta: 'card-meta' }),
  List: Object.assign('list', {
    Item: Object.assign('list-item', {
      Meta: 'list-item-meta',
    }),
  }),
  Button: 'button',
  Tag: 'tag',
  Empty: 'empty',
  Spin: 'spin',
  Modal: Object.assign('modal', { confirm: vi.fn() }),
  Form: Object.assign('form', {
    Item: 'form-item',
    useForm: () => [{ validateFields: vi.fn(), setFieldsValue: vi.fn(), resetFields: vi.fn() }],
  }),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  notification: { error: vi.fn(), success: vi.fn() },
  Tooltip: 'tooltip',
  Popconfirm: 'popconfirm',
  Rate: 'rate',
  Divider: 'divider',
  Breadcrumb: Object.assign('breadcrumb', { Item: 'breadcrumb-item' }),
  Tabs: Object.assign('tabs', { TabPane: 'tab-pane' }),
  Radio: Object.assign('radio', { Group: 'radio-group', Button: 'radio-button' }),
  Badge: 'badge',
  Comment: 'comment',
  Skeleton: 'skeleton',
  Pagination: 'pagination',
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
  LikeOutlined: () => null,
  LikeFilled: () => null,
  StarOutlined: () => null,
  StarFilled: () => null,
  MessageOutlined: () => null,
  ShareAltOutlined: () => null,
  RobotOutlined: () => null,
  ThunderboltOutlined: () => null,
  ReloadOutlined: () => null,
  CheckOutlined: () => null,
  CloseOutlined: () => null,
  ExclamationCircleOutlined: () => null,
  StopOutlined: () => null,
  BookOutlined: () => null,
  AppstoreOutlined: () => null,
  SettingOutlined: () => null,
  CrownOutlined: () => null,
  SolutionOutlined: () => null,
  CalendarOutlined: () => null,
  ApartmentOutlined: () => null,
  ContainerOutlined: () => null,
  FolderOutlined: () => null,
  ProfileOutlined: () => null,
  UnorderedListOutlined: () => null,
  FormOutlined: () => null,
  CopyOutlined: () => null,
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
// Import AFTER mocks
// ============================================================

import {
  getComments,
  createComment,
  deleteComment,
  likeArticle,
  unlikeArticle,
  favoriteArticle,
  unfavoriteArticle,
  getMyFavorites,
  submitReview,
  aiDraft,
  aiRewrite,
  aiSummary,
  aiQuery,
} from '@/api/knowledge';

import {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  getAdminArticles,
  getAdminArticle,
  takeDownArticle,
  approveReview,
  rejectReview,
  getAdminComments,
  adminDeleteComment,
} from '@/api/admin-knowledge';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Comment API Tests
// ============================================================

describe('评论 API', () => {
  describe('getComments', () => {
    it('调用正确的路径和参数', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getComments(42, 1, 10);
      expect(mockGet).toHaveBeenCalledWith('/knowledge/articles/42/comments', {
        params: { page: 1, pageSize: 10 },
      });
    });

    it('不传分页参数也能调用', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getComments(42);
      expect(mockGet).toHaveBeenCalledWith('/knowledge/articles/42/comments', {
        params: { page: undefined, pageSize: undefined },
      });
    });
  });

  describe('createComment', () => {
    it('发送正确的内容', async () => {
      const comment = { id: 1, content: '测试评论', author: { id: 1, name: '用户' } };
      mockPost.mockResolvedValue({ data: { data: comment } });
      const result = await createComment(42, '测试评论');
      expect(mockPost).toHaveBeenCalledWith('/knowledge/articles/42/comments', { content: '测试评论' });
      expect(result).toEqual(comment);
    });
  });

  describe('deleteComment', () => {
    it('调用正确的DELETE路径', async () => {
      mockDelete.mockResolvedValue({ data: { data: undefined } });
      await deleteComment(99);
      expect(mockDelete).toHaveBeenCalledWith('/knowledge/comments/99');
    });
  });
});

// ============================================================
// Like & Favorite API Tests
// ============================================================

describe('点赞与收藏 API', () => {
  describe('likeArticle', () => {
    it('PUT 到正确的路径', async () => {
      mockPut.mockResolvedValue({ data: { data: { liked: true, likeCount: 5 } } });
      await likeArticle(42);
      expect(mockPut).toHaveBeenCalledWith('/knowledge/articles/42/like');
    });
  });

  describe('unlikeArticle', () => {
    it('DELETE 到正确的路径', async () => {
      mockDelete.mockResolvedValue({ data: { data: { liked: false, likeCount: 4 } } });
      await unlikeArticle(42);
      expect(mockDelete).toHaveBeenCalledWith('/knowledge/articles/42/like');
    });
  });

  describe('favoriteArticle', () => {
    it('PUT 到正确的路径', async () => {
      mockPut.mockResolvedValue({ data: { data: { favorited: true } } });
      await favoriteArticle(42);
      expect(mockPut).toHaveBeenCalledWith('/knowledge/articles/42/favorite');
    });
  });

  describe('unfavoriteArticle', () => {
    it('DELETE 到正确的路径', async () => {
      mockDelete.mockResolvedValue({ data: { data: { favorited: false } } });
      await unfavoriteArticle(42);
      expect(mockDelete).toHaveBeenCalledWith('/knowledge/articles/42/favorite');
    });
  });

  describe('getMyFavorites', () => {
    it('调用正确的路径和参数', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getMyFavorites(1, 10);
      expect(mockGet).toHaveBeenCalledWith('/knowledge/me/favorites', {
        params: { page: 1, pageSize: 10 },
      });
    });
  });
});

// ============================================================
// Review API Tests
// ============================================================

describe('复审 API', () => {
  it('submitReview 调用正确的路径', async () => {
    mockPost.mockResolvedValue({ data: { data: { status: 'PENDING_REVIEW' } } });
    await submitReview(42);
    expect(mockPost).toHaveBeenCalledWith('/knowledge/articles/42/submit-review');
  });
});

// ============================================================
// AI API Tests
// ============================================================

describe('AI API', () => {
  describe('aiDraft', () => {
    it('发送正确的请求体', async () => {
      mockPost.mockResolvedValue({ data: { data: { content: 'AI草稿' } } });
      const result = await aiDraft('主题', '要点', '要求');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/draft',
        { topic: '主题', points: '要点', requirements: '要求' },
        { timeout: 120000 }
      );
      expect(result.content).toBe('AI草稿');
    });

    it('不传可选参数也能调用', async () => {
      mockPost.mockResolvedValue({ data: { data: { content: '草稿' } } });
      await aiDraft('主题');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/draft',
        { topic: '主题', points: undefined, requirements: undefined },
        { timeout: 120000 }
      );
    });
  });

  describe('aiRewrite', () => {
    it('发送POLISH模式', async () => {
      mockPost.mockResolvedValue({ data: { data: { content: '润色结果' } } });
      const result = await aiRewrite('原文', 'POLISH');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/rewrite',
        { selectedText: '原文', mode: 'POLISH' },
        { timeout: 120000 }
      );
      expect(result.content).toBe('润色结果');
    });

    it('发送STRUCTURE模式', async () => {
      mockPost.mockResolvedValue({ data: { data: { content: '结构化结果' } } });
      await aiRewrite('原文', 'STRUCTURE');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/rewrite',
        { selectedText: '原文', mode: 'STRUCTURE' },
        { timeout: 120000 }
      );
    });
  });

  describe('aiSummary', () => {
    it('发送正确的内容', async () => {
      mockPost.mockResolvedValue({ data: { data: { content: '摘要' } } });
      const result = await aiSummary('很长的文章');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/summary',
        { content: '很长的文章' },
        { timeout: 120000 }
      );
      expect(result.content).toBe('摘要');
    });
  });

  describe('aiQuery', () => {
    it('发送正确的问题', async () => {
      const response = {
        answer: '根据知识库...',
        sources: [{ articleId: 1, title: '参考文章' }],
      };
      mockPost.mockResolvedValue({ data: { data: response } });
      const result = await aiQuery('什么是React');
      expect(mockPost).toHaveBeenCalledWith(
        '/knowledge/ai/query',
        { question: '什么是React' },
        { timeout: 120000 }
      );
      expect(result.answer).toBe('根据知识库...');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].articleId).toBe(1);
    });

    it('返回空来源列表', async () => {
      mockPost.mockResolvedValue({
        data: { data: { answer: '无相关信息', sources: [] } },
      });
      const result = await aiQuery('不存在的问题');
      expect(result.sources).toHaveLength(0);
    });
  });
});

// ============================================================
// Admin Knowledge API Tests
// ============================================================

describe('管理员知识管理 API', () => {
  describe('分类管理', () => {
    it('getAdminCategories 调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });
      await getAdminCategories();
      expect(mockGet).toHaveBeenCalledWith('/admin/knowledge/categories');
    });

    it('createAdminCategory 发送正确的数据', async () => {
      mockPost.mockResolvedValue({ data: { data: { id: 1, name: '新分类' } } });
      const result = await createAdminCategory({ name: '新分类', description: '描述', sortOrder: 10 });
      expect(mockPost).toHaveBeenCalledWith('/admin/knowledge/categories', {
        name: '新分类',
        description: '描述',
        sortOrder: 10,
      });
      expect(result.id).toBe(1);
    });

    it('updateAdminCategory 发送正确的数据', async () => {
      mockPut.mockResolvedValue({ data: { data: { id: 1, name: '更新后' } } });
      await updateAdminCategory(1, { name: '更新后', isActive: false });
      expect(mockPut).toHaveBeenCalledWith('/admin/knowledge/categories/1', {
        name: '更新后',
        isActive: false,
      });
    });
  });

  describe('文章管理', () => {
    it('getAdminArticles 调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getAdminArticles({ page: 1, pageSize: 10, status: ['PUBLISHED', 'TAKEN_DOWN'] });
      expect(mockGet).toHaveBeenCalledWith('/admin/knowledge/articles', {
        params: { page: 1, pageSize: 10, status: ['PUBLISHED', 'TAKEN_DOWN'] },
      });
    });

    it('getAdminArticle 调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 42 } } });
      await getAdminArticle(42);
      expect(mockGet).toHaveBeenCalledWith('/admin/knowledge/articles/42');
    });

    it('takeDownArticle 发送下架原因', async () => {
      mockPost.mockResolvedValue({ data: { data: { status: 'TAKEN_DOWN' } } });
      await takeDownArticle(42, '违反规范');
      expect(mockPost).toHaveBeenCalledWith('/admin/knowledge/articles/42/take-down', {
        reason: '违反规范',
      });
    });

    it('approveReview 调用正确的路径', async () => {
      mockPost.mockResolvedValue({ data: { data: { status: 'PUBLISHED' } } });
      await approveReview(42);
      expect(mockPost).toHaveBeenCalledWith('/admin/knowledge/articles/42/review/approve');
    });

    it('rejectReview 发送拒绝原因', async () => {
      mockPost.mockResolvedValue({ data: { data: { status: 'TAKEN_DOWN' } } });
      await rejectReview(42, '内容不合格');
      expect(mockPost).toHaveBeenCalledWith('/admin/knowledge/articles/42/review/reject', {
        reason: '内容不合格',
      });
    });
  });

  describe('评论管理', () => {
    it('getAdminComments 调用正确的路径', async () => {
      mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } });
      await getAdminComments({ page: 1, keyword: '测试' });
      expect(mockGet).toHaveBeenCalledWith('/admin/knowledge/comments', {
        params: { page: 1, keyword: '测试' },
      });
    });

    it('adminDeleteComment 发送删除原因', async () => {
      mockDelete.mockResolvedValue({ data: { data: undefined } });
      await adminDeleteComment(99, '评论内容不当');
      expect(mockDelete).toHaveBeenCalledWith('/admin/knowledge/comments/99', {
        data: { reason: '评论内容不当' },
      });
    });
  });
});

// ============================================================
// Route imports — verify new pages loadable
// ============================================================

describe('新增页面可导入', () => {
  it('KnowledgeAskPage 可以导入', async () => {
    const mod = await import('@/pages/KnowledgeAskPage');
    expect(mod.default).toBeDefined();
  });

  it('MyFavoritesPage 可以导入', async () => {
    const mod = await import('@/pages/MyFavoritesPage');
    expect(mod.default).toBeDefined();
  });

  it('AdminKnowledgePage 可以导入', async () => {
    const mod = await import('@/pages/admin/AdminKnowledgePage');
    expect(mod.default).toBeDefined();
  });
});

// ============================================================
// Menu routes — verify new menu entries
// ============================================================

describe('菜单路由', () => {
  it('EmployeeLayout 包含知识社区相关菜单', async () => {
    const { default: EmployeeLayout } = await import('@/layouts/EmployeeLayout');
    expect(EmployeeLayout).toBeDefined();
  });

  it('AdminLayout 包含知识管理相关菜单', async () => {
    const { default: AdminLayout } = await import('@/layouts/AdminLayout');
    expect(AdminLayout).toBeDefined();
  });
});
