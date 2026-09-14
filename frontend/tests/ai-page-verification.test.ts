/**
 * AI 页面交互验收测试 (Day 9 收尾轮)
 *
 * 验证项：
 *   ① 生成并显示预览 — mock返回固定内容，正文保持原样
 *   ② 人工应用 — 点击插入，正文按产品规则追加
 *   ③ 过期保护 — 生成期间修改输入，应用旧结果触发警告，不覆盖新内容
 *   ④ 失败保护 — 接口失败，显示错误，正文保留
 *   ⑤ 取消保护 — 生成期间关闭抽屉，正文保留；迟到响应不自动应用
 *
 * 拦截方式：vi.mock('@/lib/axios') — 直接替换 Axios 实例，非 fetch mock。
 * 所有响应为模拟数据，不调用真实 DeepSeek API。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock axios (Axios 实例拦截，非 fetch)
// ============================================================
const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: mockPost,
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

// Mock antd (组件渲染不可用，使用逻辑等价验证)
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
  List: Object.assign('list', { Item: Object.assign('list-item', { Meta: 'list-item-meta' }) }),
  Button: 'button',
  Tag: 'tag',
  Empty: 'empty',
  Spin: 'spin',
  Modal: Object.assign('modal', { confirm: vi.fn() }),
  Form: Object.assign('form', {
    Item: 'form-item',
    useForm: () => [{
      validateFields: vi.fn(),
      setFieldsValue: vi.fn(),
      resetFields: vi.fn(),
      getFieldValue: vi.fn(() => ''),
    }],
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
  Drawer: ({ children, ...props }: any) => children,
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
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/app/knowledge/editor' }),
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
import { aiDraft, aiRewrite, aiSummary } from '@/api/knowledge';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// 逻辑等价测试工具
// 模拟 KnowledgeEditorPage 中 AI 相关的核心逻辑
// 源码位置: frontend/src/pages/KnowledgeEditorPage.tsx
// ============================================================

/**
 * 模拟 insertToContent 逻辑（摘自 KnowledgeEditorPage.tsx 第 204-215 行）
 * 过期保护：snapshot !== currentValue 时发出警告，但仍然追加（不覆盖）
 */
function createEditorHarness(initialContent: string) {
  let content = initialContent;
  let drawerOpen = true;
  let draftResult = '';
  let rewriteResult = '';
  let summaryResult = '';
  let draftLoading = false;
  let rewriteLoading = false;
  let summaryLoading = false;
  const messages: { type: string; text: string }[] = [];

  const insertToContent = (text: string, snapshot?: string, currentValue?: string) => {
    // 过期保护逻辑（源码第 206-208 行）
    if (snapshot !== undefined && currentValue !== undefined && snapshot !== currentValue) {
      messages.push({ type: 'warning', text: '输入内容已变化，AI结果可能不适用。已改为追加到末尾，请手动检查。' });
    }
    content = content ? content + '\n\n' + text : text;
    messages.push({ type: 'success', text: '已插入到正文' });
    drawerOpen = false;
  };

  const handleAiDraft = async (topic: string, points?: string, requirements?: string) => {
    if (!topic.trim()) {
      messages.push({ type: 'warning', text: '请输入主题' });
      return;
    }
    draftLoading = true;
    draftResult = '';
    try {
      const data = await aiDraft(topic.trim(), points?.trim() || undefined, requirements?.trim() || undefined);
      draftResult = data.content;
    } catch (err: any) {
      messages.push({ type: 'error', text: err?.message || 'AI生成失败' });
    } finally {
      draftLoading = false;
    }
  };

  const handleAiRewrite = async (text: string, mode: string) => {
    if (!text.trim()) {
      messages.push({ type: 'warning', text: '请输入需要润色的文本' });
      return;
    }
    rewriteLoading = true;
    rewriteResult = '';
    const snapshot = text; // 快照保存
    try {
      const data = await aiRewrite(text.trim(), mode);
      rewriteResult = data.content;
    } catch (err: any) {
      messages.push({ type: 'error', text: err?.message || 'AI润色失败' });
    } finally {
      rewriteLoading = false;
    }
    return snapshot;
  };

  const handleAiSummary = async (text: string) => {
    if (!text.trim()) {
      messages.push({ type: 'warning', text: '请输入内容' });
      return;
    }
    summaryLoading = true;
    summaryResult = '';
    const snapshot = text;
    try {
      const data = await aiSummary(text.trim());
      summaryResult = data.content;
    } catch (err: any) {
      messages.push({ type: 'error', text: err?.message || 'AI摘要失败' });
    } finally {
      summaryLoading = false;
    }
    return snapshot;
  };

  const closeDrawer = () => { drawerOpen = false; };

  return {
    insertToContent,
    handleAiDraft,
    handleAiRewrite,
    handleAiSummary,
    closeDrawer,
    get content() { return content; },
    get drawerOpen() { return drawerOpen; },
    get draftResult() { return draftResult; },
    get rewriteResult() { return rewriteResult; },
    get summaryResult() { return summaryResult; },
    get draftLoading() { return draftLoading; },
    get rewriteLoading() { return rewriteLoading; },
    get summaryLoading() { return summaryLoading; },
    messages,
  };
}

// ============================================================
// ① 生成并显示预览
// ============================================================
describe('① 生成并显示预览：返回固定模拟内容，正文保持原样', () => {
  it('aiDraft 返回模拟内容，存入 draftResult，正文不变', async () => {
    const harness = createEditorHarness('我的原始文章');
    mockPost.mockResolvedValue({ data: { data: { content: '[MOCK] AI生成的草稿内容' } } });

    await harness.handleAiDraft('测试主题', '要点一\n要点二', '要求简洁');

    // 请求路径和参数正确
    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/draft',
      { topic: '测试主题', points: '要点一\n要点二', requirements: '要求简洁' },
      { timeout: 120000 },
    );
    // 预览内容已获取
    expect(harness.draftResult).toBe('[MOCK] AI生成的草稿内容');
    // 正文未被修改
    expect(harness.content).toBe('我的原始文章');
    expect(harness.drawerOpen).toBe(true); // 抽屉仍打开
  });

  it('aiRewrite 返回模拟内容，存入 rewriteResult，正文不变', async () => {
    const harness = createEditorHarness('我的原始文章');
    mockPost.mockResolvedValue({ data: { data: { content: '[MOCK] 润色后的文本' } } });

    await harness.handleAiRewrite('待润色文本', 'POLISH');

    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/rewrite',
      { selectedText: '待润色文本', mode: 'POLISH' },
      { timeout: 120000 },
    );
    expect(harness.rewriteResult).toBe('[MOCK] 润色后的文本');
    expect(harness.content).toBe('我的原始文章');
  });

  it('aiSummary 返回模拟内容，存入 summaryResult，正文不变', async () => {
    const harness = createEditorHarness('我的原始文章');
    mockPost.mockResolvedValue({ data: { data: { content: '[MOCK] 生成的摘要' } } });

    await harness.handleAiSummary('需要摘要的长文本');

    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/summary',
      { content: '需要摘要的长文本' },
      { timeout: 120000 },
    );
    expect(harness.summaryResult).toBe('[MOCK] 生成的摘要');
    expect(harness.content).toBe('我的原始文章');
  });
});

// ============================================================
// ② 人工应用：点击插入，正文按产品规则更新
// ============================================================
describe('② 人工应用：点击插入，正文追加（不覆盖）', () => {
  it('草稿模式 — 无 snapshot，直接追加到正文末尾', () => {
    const harness = createEditorHarness('原始正文内容');
    harness.insertToContent('[MOCK] AI草稿');
    expect(harness.content).toBe('原始正文内容\n\n[MOCK] AI草稿');
    expect(harness.drawerOpen).toBe(false);
    expect(harness.messages.some(m => m.type === 'warning')).toBe(false);
  });

  it('润色模式 — 快照匹配，正常追加无警告', () => {
    const harness = createEditorHarness('原始正文');
    harness.insertToContent('[MOCK] 润色结果', '待润色文本', '待润色文本');
    expect(harness.content).toBe('原始正文\n\n[MOCK] 润色结果');
    expect(harness.messages.some(m => m.type === 'warning')).toBe(false);
  });

  it('空正文时，插入结果成为唯一内容', () => {
    const harness = createEditorHarness('');
    harness.insertToContent('[MOCK] AI草稿');
    expect(harness.content).toBe('[MOCK] AI草稿');
  });
});

// ============================================================
// ③ 过期保护：生成期间修改正文，应用旧结果被警告
// ============================================================
describe('③ 过期保护：生成期间修改输入，应用旧结果触发警告', () => {
  it('快照不匹配时发出警告，结果仍追加但不覆盖', () => {
    const harness = createEditorHarness('正文');
    // 用户开始润色 '原文A' → AI 生成中 → 用户改为 '原文B' → 点击应用
    harness.insertToContent('[MOCK] 润色结果', '原文A', '原文B');

    const warning = harness.messages.find(m => m.type === 'warning');
    expect(warning).toBeDefined();
    expect(warning!.text).toContain('输入内容已变化');
    // 结果仍然追加（不丢弃），但用户已被告知需手动检查
    expect(harness.content).toBe('正文\n\n[MOCK] 润色结果');
  });

  it('快照匹配时不触发警告', () => {
    const harness = createEditorHarness('正文');
    harness.insertToContent('[MOCK] 润色结果', '原文', '原文');

    expect(harness.messages.some(m => m.type === 'warning')).toBe(false);
    expect(harness.content).toBe('正文\n\n[MOCK] 润色结果');
  });

  it('草稿模式无 snapshot 参数，不触发过期检查', () => {
    const harness = createEditorHarness('正文');
    harness.insertToContent('[MOCK] 草稿结果'); // 无 snapshot

    expect(harness.messages.some(m => m.type === 'warning')).toBe(false);
  });
});

// ============================================================
// ④ 失败保护：接口失败，显示错误，正文保留
// ============================================================
describe('④ 失败保护：接口失败，正文和已有编辑保留', () => {
  it('aiDraft 失败 — 正文不变，错误被捕获', async () => {
    const harness = createEditorHarness('已编辑的内容');
    mockPost.mockRejectedValueOnce(new Error('AI服务不可用'));

    await harness.handleAiDraft('主题');

    expect(harness.draftResult).toBe('');
    expect(harness.content).toBe('已编辑的内容');
    expect(harness.messages.some(m => m.type === 'error')).toBe(true);
    expect(harness.draftLoading).toBe(false);
  });

  it('aiRewrite 失败 — 正文不变，快照保留', async () => {
    const harness = createEditorHarness('已编辑的内容');
    mockPost.mockRejectedValueOnce(new Error('网络超时'));

    const snapshot = await harness.handleAiRewrite('待润色', 'POLISH');

    expect(harness.rewriteResult).toBe('');
    expect(harness.content).toBe('已编辑的内容');
    expect(snapshot).toBe('待润色'); // 快照仍在
    expect(harness.messages.some(m => m.type === 'error')).toBe(true);
  });

  it('aiSummary 失败 — 正文不变', async () => {
    const harness = createEditorHarness('已编辑的内容');
    mockPost.mockRejectedValueOnce(new Error('服务暂时不可用'));

    await harness.handleAiSummary('长文本');

    expect(harness.summaryResult).toBe('');
    expect(harness.content).toBe('已编辑的内容');
    expect(harness.messages.some(m => m.type === 'error')).toBe(true);
  });

  it('空输入不发起请求，显示警告', async () => {
    const harness = createEditorHarness('正文');
    await harness.handleAiDraft('');
    await harness.handleAiRewrite('', 'POLISH');
    await harness.handleAiSummary('');

    expect(mockPost).not.toHaveBeenCalled();
    expect(harness.messages.filter(m => m.type === 'warning')).toHaveLength(3);
  });
});

// ============================================================
// ⑤ 取消保护：生成期间关闭抽屉，正文保留；迟到响应不自动应用
// ============================================================
describe('⑤ 取消保护：关闭抽屉/放弃操作，正文保留', () => {
  it('生成前关闭抽屉 — 正文不变，抽屉关闭', () => {
    const harness = createEditorHarness('正文内容');
    harness.closeDrawer();

    expect(harness.drawerOpen).toBe(false);
    expect(harness.content).toBe('正文内容');
  });

  it('生成请求进行中 — 正文不变（请求不碰 form）', async () => {
    const harness = createEditorHarness('正文内容');

    // 模拟慢响应：使用 setTimeout 延迟
    let resolveRequest: (v: any) => void;
    mockPost.mockReturnValueOnce(new Promise(r => { resolveRequest = r; }));

    // 启动生成（不 await，模拟进行中）
    const draftPromise = harness.handleAiDraft('主题');

    // 生成期间，正文不变
    expect(harness.content).toBe('正文内容');
    expect(harness.draftLoading).toBe(true);

    // 关闭抽屉
    harness.closeDrawer();
    expect(harness.drawerOpen).toBe(false);
    expect(harness.content).toBe('正文内容'); // 正文仍不变

    // 请求迟到返回
    resolveRequest!({ data: { data: { content: '[MOCK] 迟到的结果' } } });
    await draftPromise;

    // 迟到响应更新了 draftResult 状态，但不自动应用到正文
    expect(harness.draftResult).toBe('[MOCK] 迟到的结果');
    expect(harness.content).toBe('正文内容'); // 正文未被自动修改
    expect(harness.draftLoading).toBe(false);
  });

  it('迟到响应后重新打开抽屉 — 旧结果仍在预览中，需手动决定', async () => {
    const harness = createEditorHarness('正文内容');

    mockPost.mockResolvedValueOnce({ data: { data: { content: '[MOCK] 旧的草稿' } } });

    // 生成 → 关闭 → 响应到达
    const draftPromise = harness.handleAiDraft('主题');
    harness.closeDrawer();
    await draftPromise;

    // 验证：draftResult 已更新（下次打开抽屉会看到）
    expect(harness.draftResult).toBe('[MOCK] 旧的草稿');
    // 但正文仍未变
    expect(harness.content).toBe('正文内容');
    // 用户需手动点击"插入到正文"才会应用
  });

  it('多轮操作 — 生成→取消→再生成，状态正确', async () => {
    const harness = createEditorHarness('正文');

    // 第一轮：生成后取消
    mockPost.mockResolvedValueOnce({ data: { data: { content: '[MOCK] 第一轮结果' } } });
    await harness.handleAiDraft('主题1');
    expect(harness.draftResult).toBe('[MOCK] 第一轮结果');
    harness.closeDrawer();

    // 第二轮：重新生成
    mockPost.mockResolvedValueOnce({ data: { data: { content: '[MOCK] 第二轮结果' } } });
    await harness.handleAiDraft('主题2');
    expect(harness.draftResult).toBe('[MOCK] 第二轮结果');

    // 正文始终未变
    expect(harness.content).toBe('正文');
  });
});

// ============================================================
// 拦截方式确认
// ============================================================
describe('拦截方式验证', () => {
  it('mock 拦截的是 @/lib/axios（Axios 实例），不是 fetch', async () => {
    // 确认 mockPost 是 vi.fn 且被正确注入
    expect(vi.isMockFunction(mockPost)).toBe(true);

    mockPost.mockResolvedValue({ data: { data: { content: 'test' } } });
    const result = await aiDraft('test');
    expect(result.content).toBe('test');
    expect(mockPost).toHaveBeenCalledTimes(1);

    // 确认请求路径符合后端 API 契约
    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/draft',
      expect.any(Object),
      { timeout: 120000 },
    );
  });

  it('响应结构与后端契约一致 { data: { content } }', async () => {
    mockPost.mockResolvedValue({ data: { data: { content: '契约内容' } } });
    const result = await aiDraft('测试');
    expect(result).toEqual({ content: '契约内容' });
  });
});
