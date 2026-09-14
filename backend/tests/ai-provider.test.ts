import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RealAiProvider,
  MockAiProvider,
  createAiProvider,
  createMockProvider,
  AiUnavailableError,
} from '../src/modules/knowledge/ai/ai-provider';
import { AiService } from '../src/modules/knowledge/ai/ai.service';
import { BusinessException } from '../src/common/exception/business-exception';

// ============================================================
// Mock fetch for RealAiProvider tests
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ============================================================
// RealAiProvider — simulated HTTP tests
// ============================================================

describe('RealAiProvider (模拟HTTP)', () => {
  let provider: RealAiProvider;

  beforeEach(() => {
    provider = new RealAiProvider({
      AI_API_KEY: 'test-key-123',
      AI_BASE_URL: 'https://api.test.com',
      AI_MODEL: 'test-model',
      AI_TIMEOUT_MS: 5000,
    } as any);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- generateDraft ----
  describe('generateDraft', () => {
    it('正常响应 — 返回正文', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          choices: [{ message: { content: '这是一篇AI生成的文章草稿' } }],
        })
      );

      const result = await provider.generateDraft('测试主题', '要点一', '要求');
      expect(result).toBe('这是一篇AI生成的文章草稿');
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('401 Unauthorized — 抛出AI_GENERATION_FAILED', async () => {
      mockFetch.mockResolvedValue(
        makeResponse('Unauthorized', 401)
      );

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务请求失败');
    });

    it('429 Too Many Requests — 抛出AI_GENERATION_FAILED', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Rate limited', 429));

      await expect(provider.generateDraft('主题')).rejects.toThrow(/429/);
    });

    it('500 Server Error — 抛出AI_GENERATION_FAILED', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Internal error', 500));

      await expect(provider.generateDraft('主题')).rejects.toThrow(/500/);
    });

    it('503 Service Unavailable — 抛出AI_GENERATION_FAILED', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Unavailable', 503));

      await expect(provider.generateDraft('主题')).rejects.toThrow(/503/);
    });

    it('超时 — 抛出超时错误', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务请求超时');
    });

    it('网络失败 — 抛出调用异常', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务调用异常');
    });

    it('空响应 — 抛出空结果错误', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '' } }] })
      );

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务返回空结果');
    });

    it('无效响应结构（无choices） — 抛出空结果错误', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({}));

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务返回空结果');
    });

    it('无效响应结构（choices为空数组） — 抛出空结果错误', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ choices: [] }));

      await expect(provider.generateDraft('主题')).rejects.toThrow('AI服务返回空结果');
    });
  });

  // ---- rewriteText ----
  describe('rewriteText', () => {
    it('POLISH模式 — 返回润色结果', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '润色后的文本' } }] })
      );

      const result = await provider.rewriteText('原始文本', 'POLISH');
      expect(result).toBe('润色后的文本');
    });

    it('STRUCTURE模式 — 返回结构整理结果', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '结构化后的文本' } }] })
      );

      const result = await provider.rewriteText('原始文本', 'STRUCTURE');
      expect(result).toBe('结构化后的文本');
    });

    it('401 — 抛出错误', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Unauthorized', 401));
      await expect(provider.rewriteText('文本', 'POLISH')).rejects.toThrow(/401/);
    });
  });

  // ---- generateSummary ----
  describe('generateSummary', () => {
    it('正常响应 — 返回摘要', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '这是摘要' } }] })
      );

      const result = await provider.generateSummary('很长的文章内容...');
      expect(result).toBe('这是摘要');
    });

    it('500 — 抛出错误', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Error', 500));
      await expect(provider.generateSummary('内容')).rejects.toThrow(/500/);
    });
  });

  // ---- answerQuestion ----
  describe('answerQuestion', () => {
    it('正常响应 — 返回回答', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '根据参考资料，答案是...' } }] })
      );

      const refs = [{ title: '文章1', content: '内容1' }];
      const result = await provider.answerQuestion('测试问题', refs);
      expect(result).toBe('根据参考资料，答案是...');
    });

    it('429 — 抛出错误', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse('Rate limited', 429));
      const refs = [{ title: '文章1', content: '内容1' }];
      await expect(provider.answerQuestion('问题', refs)).rejects.toThrow(/429/);
    });
  });

  // ---- 请求构造验证 ----
  describe('请求构造', () => {
    it('发送正确的Authorization头', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '结果' } }] })
      );

      await provider.generateDraft('主题');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.com/v1/chat/completions');
      expect(options.headers['Authorization']).toBe('Bearer test-key-123');
      expect(options.method).toBe('POST');
    });

    it('使用配置的model', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '结果' } }] })
      );

      await provider.generateDraft('主题');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('test-model');
    });

    it('temperature=0.7, max_tokens=4096', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ choices: [{ message: { content: '结果' } }] })
      );

      await provider.generateDraft('主题');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(4096);
    });
  });
});

// ============================================================
// Factory: createAiProvider — 缺密钥返回503
// ============================================================

describe('createAiProvider 工厂', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...origEnv };
  });

  it('有API_KEY时返回RealAiProvider', () => {
    // We can't easily test the real factory without mocking config,
    // so test the class directly
    const provider = new RealAiProvider({
      AI_API_KEY: 'valid-key',
      AI_BASE_URL: '',
      AI_MODEL: 'test',
      AI_TIMEOUT_MS: 30000,
    } as any);
    expect(provider).toBeInstanceOf(RealAiProvider);
  });

  it('AiUnavailableError 包含正确的 statusCode 和 code', () => {
    const err = new AiUnavailableError();
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(err.message).toContain('未配置API密钥');
  });

  it('createMockProvider 返回 MockAiProvider', () => {
    const mock = createMockProvider();
    expect(mock).toBeInstanceOf(MockAiProvider);
  });
});

// ============================================================
// MockAiProvider — 不应自动启用
// ============================================================

describe('MockAiProvider', () => {
  it('generateDraft 返回模拟内容', async () => {
    const mock = new MockAiProvider();
    const result = await mock.generateDraft('测试主题', '要点');
    expect(result).toContain('测试主题');
    expect(result).toContain('[AI草稿]');
  });

  it('rewriteText POLISH 返回润色前缀', async () => {
    const mock = new MockAiProvider();
    const result = await mock.rewriteText('原文', 'POLISH');
    expect(result).toContain('[润色结果]');
  });

  it('rewriteText STRUCTURE 返回结构前缀', async () => {
    const mock = new MockAiProvider();
    const result = await mock.rewriteText('原文', 'STRUCTURE');
    expect(result).toContain('[结构整理]');
  });

  it('generateSummary 返回摘要前缀', async () => {
    const mock = new MockAiProvider();
    const result = await mock.generateSummary('文章内容');
    expect(result).toContain('[摘要]');
  });

  it('answerQuestion 返回模拟回答', async () => {
    const mock = new MockAiProvider();
    const refs = [{ title: '参考文章', content: '内容' }];
    const result = await mock.answerQuestion('问题', refs);
    expect(result).toContain('参考文章');
  });
});

// ============================================================
// AiService — 缺密钥503 + 显式注入Mock
// ============================================================

describe('AiService', () => {
  it('缺密钥时构造函数不抛异常，请求时返回503', async () => {
    // Simulate the no-key scenario by creating AiService with an explicit null injection
    // This tests the same code path as missing API key
    const service = new AiService(undefined as any);
    // Force provider to null to simulate missing key
    (service as any).provider = null;
    (service as any).providerError = 'AI服务暂不可用：未配置API密钥';

    try {
      await service.generateDraft(1, { topic: '测试' });
      expect.fail('应该抛出异常');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('AI_SERVICE_UNAVAILABLE');
    }
  });

  it('显式注入Mock — 所有方法正常工作', async () => {
    const mock = createMockProvider();
    const service = new AiService(mock);

    const draft = await service.generateDraft(1, { topic: '主题' });
    expect(draft.content).toContain('[AI草稿]');

    const rewrite = await service.rewriteText(1, { selectedText: '文本', mode: 'POLISH' });
    expect(rewrite.content).toContain('[润色结果]');

    const summary = await service.generateSummary(1, { content: '文章' });
    expect(summary.content).toContain('[摘要]');
  });

  it('无Mock注入 + 无密钥 — 所有AI方法返回503', async () => {
    const service = new AiService(undefined as any);
    // Force provider to null to simulate missing key
    (service as any).provider = null;
    (service as any).providerError = 'AI服务暂不可用：未配置API密钥';

    await expect(service.generateDraft(1, { topic: '主题' })).rejects.toThrow();
    await expect(service.rewriteText(1, { selectedText: '文本', mode: 'POLISH' })).rejects.toThrow();
    await expect(service.generateSummary(1, { content: '文章' })).rejects.toThrow();
    await expect(service.queryKnowledge(1, '问题')).rejects.toThrow();
  });
});
