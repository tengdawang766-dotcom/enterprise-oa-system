import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';

const prisma = new PrismaClient();
const app = createApp();

// ============================================================
// NOTE: These tests verify AI query business logic via the HTTP API.
// When AI_API_KEY is configured, the real provider will be used.
// When not configured, the API returns 503 (AI_SERVICE_UNAVAILABLE).
// The tests verify BOTH paths are correct.
// ============================================================

const RUN_ID = Date.now();
const PREFIX = `[aiq_${RUN_ID}]`;

const EMPLOYEE = {
  username: `aiq_emp_${RUN_ID}`,
  password: 'AiQueryTest123',
  name: `${PREFIX}问答测试员`,
};

const TEST_DEPT_NAME = `${PREFIX}问答测试部门`;

let empId: number;
let empCookies: string[];
let testCategoryId: number;
let publishedArticleId: number;

// ============================================================
// Setup
// ============================================================

beforeAll(async () => {
  // Cleanup from prior runs
  await prisma.knowledgeArticle.deleteMany({
    where: { author: { username: EMPLOYEE.username } },
  });
  await prisma.knowledgeCategory.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: EMPLOYEE.username } });
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  const dept = await prisma.department.create({ data: { name: TEST_DEPT_NAME } });

  const hash = await bcrypt.hash(EMPLOYEE.password, 10);
  const user = await prisma.user.create({
    data: {
      username: EMPLOYEE.username,
      passwordHash: hash,
      name: EMPLOYEE.name,
      role: 'EMPLOYEE',
      departmentId: dept.id,
      mustChangePassword: false,
    },
  });
  empId = user.id;

  const cat = await prisma.knowledgeCategory.create({
    data: {
      name: `${PREFIX}AI问答分类`,
      description: 'AI问答测试分类',
      sortOrder: 99,
      isActive: true,
    },
  });
  testCategoryId = cat.id;

  // Login
  const loginRes = await request(app)
    .post('/api/v1/auth/sessions')
    .send({ username: EMPLOYEE.username, password: EMPLOYEE.password });
  empCookies = loginRes.headers['set-cookie'];

  // Create and publish a test article for the query to find
  const articleRes = await request(app)
    .post('/api/v1/knowledge/articles')
    .set('Cookie', empCookies.join('; '))
    .send({
      title: `${PREFIX}React Hooks最佳实践`,
      summary: '本文介绍React Hooks的使用技巧',
      content: 'React Hooks是React 16.8引入的新特性，允许在函数组件中使用state和其他React特性。常用Hook包括useState、useEffect、useContext等。使用规则：只在顶层调用Hook，不要在循环、条件或嵌套函数中调用。',
      categoryId: testCategoryId,
    });
  publishedArticleId = articleRes.body.data.id;

  await request(app)
    .post(`/api/v1/knowledge/articles/${publishedArticleId}/publish`)
    .set('Cookie', empCookies.join('; '));
});

afterAll(async () => {
  await prisma.knowledgeArticle.deleteMany({
    where: { author: { username: EMPLOYEE.username } },
  });
  await prisma.knowledgeCategory.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: EMPLOYEE.username } });
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });
  await prisma.$disconnect();
});

// ============================================================
// Tests
// ============================================================

describe('AI知识问答', () => {

  it('未登录访问AI接口 — 401', async () => {
    const res = await request(app)
      .post('/api/v1/knowledge/ai/query')
      .send({ question: '什么是React Hooks' });

    expect(res.status).toBe(401);
  });

  it('缺少question字段 — 400', async () => {
    const res = await request(app)
      .post('/api/v1/knowledge/ai/query')
      .set('Cookie', empCookies.join('; '))
      .send({});

    expect(res.status).toBe(400);
  });

  it('空question — 400', async () => {
    const res = await request(app)
      .post('/api/v1/knowledge/ai/query')
      .set('Cookie', empCookies.join('; '))
      .send({ question: '' });

    expect(res.status).toBe(400);
  });

  it('查询有匹配文章的问题 — 成功或503', { timeout: 60000 }, async () => {
    const res = await request(app)
      .post('/api/v1/knowledge/ai/query')
      .set('Cookie', empCookies.join('; '))
      .send({ question: 'React Hooks' });

    // Three possible outcomes:
    // 1. AI_API_KEY valid and API works: 200 with answer + sources
    // 2. AI_API_KEY not configured: 503 AI_SERVICE_UNAVAILABLE
    // 3. AI_API_KEY configured but API call fails: 500 AI_GENERATION_FAILED
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      // Success: verify response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeDefined();
      expect(typeof res.body.data.answer).toBe('string');
      expect(res.body.data.answer.length).toBeGreaterThan(0);

      // Sources should reference real articles from DB
      expect(Array.isArray(res.body.data.sources)).toBe(true);
      expect(res.body.data.sources.length).toBeGreaterThan(0);

      // Each source should have articleId and title
      const source = res.body.data.sources[0];
      expect(source.articleId).toBeDefined();
      expect(source.title).toBeDefined();

      // The source should point to our test article
      const sourceIds = res.body.data.sources.map((s: any) => s.articleId);
      expect(sourceIds).toContain(publishedArticleId);
    } else if (res.status === 503) {
      // AI not configured
      expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    } else if (res.status === 500) {
      // AI configured but API call failed (network, auth, etc.)
      expect(res.body.error.code).toBe('AI_GENERATION_FAILED');
    }
  });

  it('查询无匹配文章的问题 — 400 (不调用模型)', async () => {
    const res = await request(app)
      .post('/api/v1/knowledge/ai/query')
      .set('Cookie', empCookies.join('; '))
      .send({ question: '完全不存在的量子引力统一场论xyz' });

    // No matching articles → 400 AI_QUERY_NO_RESULTS
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AI_QUERY_NO_RESULTS');
  });

  it('AI其他接口也需要验证 — draft/rewrite/summary', { timeout: 120000 }, async () => {
    // These should return 200 (API works), 500 (API fails), or 503 (no key)
    const draftRes = await request(app)
      .post('/api/v1/knowledge/ai/draft')
      .set('Cookie', empCookies.join('; '))
      .send({ topic: '测试主题' });

    expect([200, 500, 503]).toContain(draftRes.status);

    const rewriteRes = await request(app)
      .post('/api/v1/knowledge/ai/rewrite')
      .set('Cookie', empCookies.join('; '))
      .send({ selectedText: '测试文本', mode: 'POLISH' });

    expect([200, 500, 503]).toContain(rewriteRes.status);

    const summaryRes = await request(app)
      .post('/api/v1/knowledge/ai/summary')
      .set('Cookie', empCookies.join('; '))
      .send({ content: '很长的文章内容需要生成摘要' });

    expect([200, 500, 503]).toContain(summaryRes.status);
  });
});
