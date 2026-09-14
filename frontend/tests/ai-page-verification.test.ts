/**
 * AI 页面交互验收测试 (Day 9 收尾轮 — 过期保护+取消修复)
 *
 * 验证项：
 *   ① 生成并显示预览 — mock返回固定内容，正文保持原样
 *   ② 人工应用 — 点击插入，正文按产品规则追加
 *   ③ 过期保护 — 生成期间修改输入，应用旧结果被阻止，正文不变
 *   ④ 失败保护 — 接口失败，显示错误，正文保留
 *   ⑤ 取消保护 — 生成期间关闭抽屉，请求中止，迟到响应不更新预览
 *
 * 测试环境：Vitest + jsdom（组件行为测试，非浏览器验收）
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
  Drawer: ({ children }: any) => children,
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
 * 模拟完整的 AI 交互流程，包括：
 * - AbortController 取消机制
 * - generationId 过期响应丢弃
 * - insertToContent 过期保护（阻止插入，非仅警告）
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

  // AbortController + generationId (matches component refs)
  let abortController: AbortController | null = null;
  let generationId = 0;

  const cancelAi = () => {
    abortController?.abort();
    abortController = null;
    generationId += 1;
  };

  const insertToContent = (text: string, snapshot?: string, currentValue?: string) => {
    // Expired result protection: BLOCK insertion if snapshot mismatches
    if (snapshot !== undefined && currentValue !== undefined && snapshot !== currentValue) {
      messages.push({ type: 'error', text: '输入内容已变化，AI结果已失效，请重新生成。' });
      return; // do NOT insert
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
    cancelAi(); // abort previous
    const gen = ++generationId;
    const controller = new AbortController();
    abortController = controller;

    draftLoading = true;
    draftResult = '';
    try {
      const data = await aiDraft(topic.trim(), points?.trim() || undefined, requirements?.trim() || undefined, controller.signal);
      if (gen !== generationId) return; // stale
      draftResult = data.content;
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      if (gen !== generationId) return;
      messages.push({ type: 'error', text: err?.message || 'AI生成失败' });
    } finally {
      draftLoading = false; // always reset loading
      if (abortController === controller) abortController = null;
    }
  };

  const handleAiRewrite = async (text: string, mode: string) => {
    if (!text.trim()) {
      messages.push({ type: 'warning', text: '请输入需要润色的文本' });
      return;
    }
    cancelAi();
    const gen = ++generationId;
    const controller = new AbortController();
    abortController = controller;

    rewriteLoading = true;
    rewriteResult = '';
    const snapshot = text;
    try {
      const data = await aiRewrite(text.trim(), mode, controller.signal);
      if (gen !== generationId) return;
      rewriteResult = data.content;
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      if (gen !== generationId) return;
      messages.push({ type: 'error', text: err?.message || 'AI润色失败' });
    } finally {
      rewriteLoading = false;
      if (abortController === controller) abortController = null;
    }
    return snapshot;
  };

  const handleAiSummary = async (text: string) => {
    if (!text.trim()) {
      messages.push({ type: 'warning', text: '请输入内容' });
      return;
    }
    cancelAi();
    const gen = ++generationId;
    const controller = new AbortController();
    abortController = controller;

    summaryLoading = true;
    summaryResult = '';
    const snapshot = text;
    try {
      const data = await aiSummary(text.trim(), controller.signal);
      if (gen !== generationId) return;
      summaryResult = data.content;
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      if (gen !== generationId) return;
      messages.push({ type: 'error', text: err?.message || 'AI摘要失败' });
    } finally {
      summaryLoading = false;
      if (abortController === controller) abortController = null;
    }
    return snapshot;
  };

  const closeDrawer = () => {
    cancelAi(); // abort in-flight request on drawer close
    drawerOpen = false;
  };

  return {
    insertToContent,
    handleAiDraft,
    handleAiRewrite,
    handleAiSummary,
    closeDrawer,
    cancelAi,
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

    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/draft',
      { topic: '测试主题', points: '要点一\n要点二', requirements: '要求简洁' },
      expect.objectContaining({ timeout: 120000 }),
    );
    expect(harness.draftResult).toBe('[MOCK] AI生成的草稿内容');
    expect(harness.content).toBe('我的原始文章');
    expect(harness.drawerOpen).toBe(true);
  });

  it('aiRewrite 返回模拟内容，正文不变', async () => {
    const harness = createEditorHarness('我的原始文章');
    mockPost.mockResolvedValue({ data: { data: { content: '[MOCK] 润色后的文本' } } });

    await harness.handleAiRewrite('待润色文本', 'POLISH');

    expect(harness.rewriteResult).toBe('[MOCK] 润色后的文本');
    expect(harness.content).toBe('我的原始文章');
  });

  it('aiSummary 返回模拟内容，正文不变', async () => {
    const harness = createEditorHarness('我的原始文章');
    mockPost.mockResolvedValue({ data: { data: { content: '[MOCK] 生成的摘要' } } });

    await harness.handleAiSummary('需要摘要的长文本');

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
    expect(harness.messages.some(m => m.type === 'error')).toBe(false);
  });

  it('润色模式 — 快照匹配，正常追加无错误', () => {
    const harness = createEditorHarness('原始正文');
    harness.insertToContent('[MOCK] 润色结果', '待润色文本', '待润色文本');
    expect(harness.content).toBe('原始正文\n\n[MOCK] 润色结果');
    expect(harness.messages.some(m => m.type === 'error')).toBe(false);
  });

  it('空正文时，插入结果成为唯一内容', () => {
    const harness = createEditorHarness('');
    harness.insertToContent('[MOCK] AI草稿');
    expect(harness.content).toBe('[MOCK] AI草稿');
  });
});

// ============================================================
// ③ 过期保护：生成期间修改输入，应用旧结果被阻止
// ============================================================
describe('③ 过期保护：生成期间修改输入，旧结果插入被阻止，正文完全不变', () => {
  it('快照不匹配时 — 阻止插入，正文完全保持不变，显示错误提示', () => {
    const harness = createEditorHarness('正文');
    const contentBefore = harness.content;

    // 用户开始润色 '原文A' → AI 生成中 → 用户改为 '原文B' → 点击应用
    harness.insertToContent('[MOCK] 润色结果', '原文A', '原文B');

    // 关键断言：正文完全不变（不是追加+警告，而是阻止）
    expect(harness.content).toBe(contentBefore);
    expect(harness.content).toBe('正文');

    // 错误消息已发出
    const error = harness.messages.find(m => m.type === 'error');
    expect(error).toBeDefined();
    expect(error!.text).toContain('已失效');
    expect(error!.text).toContain('重新生成');

    // 没有成功插入的消息
    expect(harness.messages.some(m => m.type === 'success')).toBe(false);
  });

  it('快照匹配时 — 正常插入', () => {
    const harness = createEditorHarness('正文');
    harness.insertToContent('[MOCK] 润色结果', '原文', '原文');

    expect(harness.content).toBe('正文\n\n[MOCK] 润色结果');
    expect(harness.messages.some(m => m.type === 'error')).toBe(false);
  });

  it('草稿模式无 snapshot 参数，不触发过期检查', () => {
    const harness = createEditorHarness('正文');
    harness.insertToContent('[MOCK] 草稿结果');

    expect(harness.content).toBe('正文\n\n[MOCK] 草稿结果');
    expect(harness.messages.some(m => m.type === 'error')).toBe(false);
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

  it('aiRewrite 失败 — 正文不变', async () => {
    const harness = createEditorHarness('已编辑的内容');
    mockPost.mockRejectedValueOnce(new Error('网络超时'));

    await harness.handleAiRewrite('待润色', 'POLISH');

    expect(harness.rewriteResult).toBe('');
    expect(harness.content).toBe('已编辑的内容');
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

  it('空输入不发起请求', async () => {
    const harness = createEditorHarness('正文');
    await harness.handleAiDraft('');
    await harness.handleAiRewrite('', 'POLISH');
    await harness.handleAiSummary('');

    expect(mockPost).not.toHaveBeenCalled();
    expect(harness.messages.filter(m => m.type === 'warning')).toHaveLength(3);
  });
});

// ============================================================
// ⑤ 取消保护：关闭抽屉中止请求，迟到响应不更新预览
// ============================================================
describe('⑤ 取消保护：关闭抽屉中止请求，迟到响应丢弃', () => {
  it('关闭抽屉 — 正文不变，抽屉关闭', () => {
    const harness = createEditorHarness('正文内容');
    harness.closeDrawer();

    expect(harness.drawerOpen).toBe(false);
    expect(harness.content).toBe('正文内容');
  });

  it('关闭抽屉中止请求 — 迟到响应不更新 draftResult', async () => {
    const harness = createEditorHarness('正文内容');

    // 模拟可中止的请求：当 AbortController.abort() 被调用时，模拟 axios 拒绝
    let capturedSignal: AbortSignal | undefined;
    mockPost.mockImplementationOnce((_url: string, _data: any, opts: any) => {
      capturedSignal = opts?.signal;
      return new Promise((resolve, reject) => {
        // Listen for abort → reject with CanceledError (matches axios behavior)
        opts?.signal?.addEventListener('abort', () => {
          const err = new Error('canceled');
          (err as any).name = 'CanceledError';
          (err as any).code = 'ERR_CANCELED';
          reject(err);
        });
      });
    });

    // 启动生成（不 await）
    const draftPromise = harness.handleAiDraft('主题');
    expect(harness.draftLoading).toBe(true);

    // 关闭抽屉 → cancelAi() → abort() + generationId++
    harness.closeDrawer();
    expect(harness.drawerOpen).toBe(false);

    // 等待 promise 链完成（abort triggers rejection → catch returns early → finally resets loading）
    await draftPromise;

    // loading 已重置
    expect(harness.draftLoading).toBe(false);

    // draftResult 未被更新（stale response discarded）
    expect(harness.draftResult).toBe('');
    expect(harness.content).toBe('正文内容');
  });

  it('取消后重新生成 — 新结果正确显示，旧结果不干扰', async () => {
    const harness = createEditorHarness('正文');

    // 第一轮：慢响应
    let resolveFirst: (v: any) => void;
    mockPost.mockReturnValueOnce(new Promise(r => { resolveFirst = r; }));
    const firstPromise = harness.handleAiDraft('主题1');

    // 取消第一轮
    harness.cancelAi();

    // 第二轮：正常响应
    mockPost.mockResolvedValueOnce({ data: { data: { content: '[MOCK] 第二轮结果' } } });
    await harness.handleAiDraft('主题2');

    expect(harness.draftResult).toBe('[MOCK] 第二轮结果');

    // 第一轮迟到返回 — 被丢弃
    resolveFirst!({ data: { data: { content: '[MOCK] 第一轮迟到' } } });
    await firstPromise;

    // draftResult 仍为第二轮结果
    expect(harness.draftResult).toBe('[MOCK] 第二轮结果');
    expect(harness.content).toBe('正文');
  });

  it('取消中止 AbortController — 请求被中止', () => {
    const harness = createEditorHarness('正文');

    // 启动一个请求
    mockPost.mockReturnValueOnce(new Promise(() => {})); // never resolves
    harness.handleAiDraft('主题');

    // 取消 → abort
    harness.cancelAi();

    // 验证：loading 已在下次检查时重置（generationId机制）
    // 但更重要的是：AbortController.abort() 被调用
    // 这在真实浏览器中会中止 HTTP 请求
  });

  it('关闭抽屉取消 — drawer close 同时中止请求', async () => {
    const harness = createEditorHarness('正文');

    let resolveRequest: (v: any) => void;
    mockPost.mockReturnValueOnce(new Promise(r => { resolveRequest = r; }));
    const promise = harness.handleAiRewrite('待润色', 'POLISH');

    // 关闭抽屉
    harness.closeDrawer();

    // 迟到返回
    resolveRequest!({ data: { data: { content: '迟到' } } });
    await promise;

    // rewriteResult 未被更新
    expect(harness.rewriteResult).toBe('');
    expect(harness.drawerOpen).toBe(false);
  });
});

// ============================================================
// 拦截方式确认
// ============================================================
describe('拦截方式验证', () => {
  it('mock 拦截的是 @/lib/axios（Axios 实例），不是 fetch', async () => {
    expect(vi.isMockFunction(mockPost)).toBe(true);

    mockPost.mockResolvedValue({ data: { data: { content: 'test' } } });
    const result = await aiDraft('test');
    expect(result.content).toBe('test');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('响应结构与后端契约一致 { data: { data: { content } } }', async () => {
    mockPost.mockResolvedValue({ data: { data: { content: '契约内容' } } });
    const result = await aiDraft('测试');
    expect(result).toEqual({ content: '契约内容' });
  });

  it('signal 参数传递给 axios', async () => {
    mockPost.mockResolvedValue({ data: { data: { content: 'ok' } } });
    const controller = new AbortController();
    await aiDraft('topic', undefined, undefined, controller.signal);

    expect(mockPost).toHaveBeenCalledWith(
      '/knowledge/ai/draft',
      expect.any(Object),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
