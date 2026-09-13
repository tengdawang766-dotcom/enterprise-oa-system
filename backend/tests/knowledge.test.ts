import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';

const prisma = new PrismaClient();
const app = createApp();

// ============================================================
// Unique prefix to isolate this test run
// ============================================================
const RUN_ID = Date.now();
const PREFIX = `[know_${RUN_ID}]`;

// ============================================================
// Test Data
// ============================================================

const ADMIN_USER = {
  username: `know_admin_${RUN_ID}`,
  password: 'AdminTest123',
  name: `${PREFIX}管理员`,
};

const EMPLOYEE_A = {
  username: `know_emp_a_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工A`,
};

const EMPLOYEE_B = {
  username: `know_emp_b_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工B`,
};

const MUST_CHANGE_EMP = {
  username: `know_mc_${RUN_ID}`,
  password: 'MustChange123',
  name: `${PREFIX}强制改密`,
};

const DISABLED_EMP = {
  username: `know_disabled_${RUN_ID}`,
  password: 'DisabledTest123',
  name: `${PREFIX}停用员工`,
};

const TEST_DEPT_NAME = `${PREFIX}测试部门`;

let adminId: number;
let adminCookies: string[];
let empAId: number;
let empACookies: string[];
let empBId: number;
let empBCookies: string[];
let mustChangeId: number;
let mustChangeCookies: string[];
let disabledId: number;
let disabledCookies: string[];
let testDeptId: number;
let testCategoryId: number;
let disabledCategoryId: number;

// Track all article IDs created by this test
const createdArticleIds: number[] = [];

// ============================================================
// Helper
// ============================================================

async function loginAs(username: string, password: string): Promise<string[]> {
  const res = await request(app)
    .post('/api/v1/auth/sessions')
    .send({ username, password });
  return res.headers['set-cookie'];
}

// ============================================================
// Setup
// ============================================================

beforeAll(async () => {
  // Clean ONLY our test data (in case of prior crash)
  await prisma.knowledgeArticle.deleteMany({
    where: { author: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } } },
  });
  await prisma.knowledgeCategory.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } },
  });
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  // Create department
  const dept = await prisma.department.create({ data: { name: TEST_DEPT_NAME } });
  testDeptId = dept.id;

  // Create admin
  const adminHash = await bcrypt.hash(ADMIN_USER.password, 10);
  const admin = await prisma.user.create({
    data: {
      username: ADMIN_USER.username,
      passwordHash: adminHash,
      name: ADMIN_USER.name,
      role: 'ADMIN',
      mustChangePassword: false,
    },
  });
  adminId = admin.id;

  // Create employees
  const empHash = await bcrypt.hash(EMPLOYEE_A.password, 10);
  const empA = await prisma.user.create({
    data: {
      username: EMPLOYEE_A.username,
      passwordHash: empHash,
      name: EMPLOYEE_A.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      mustChangePassword: false,
    },
  });
  empAId = empA.id;

  const empB = await prisma.user.create({
    data: {
      username: EMPLOYEE_B.username,
      passwordHash: empHash,
      name: EMPLOYEE_B.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      mustChangePassword: false,
    },
  });
  empBId = empB.id;

  // Must-change-password employee
  const mcHash = await bcrypt.hash(MUST_CHANGE_EMP.password, 10);
  const mc = await prisma.user.create({
    data: {
      username: MUST_CHANGE_EMP.username,
      passwordHash: mcHash,
      name: MUST_CHANGE_EMP.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      mustChangePassword: true,
    },
  });
  mustChangeId = mc.id;

  // Disabled employee (created ENABLED, will be disabled after login)
  const disHash = await bcrypt.hash(DISABLED_EMP.password, 10);
  const dis = await prisma.user.create({
    data: {
      username: DISABLED_EMP.username,
      passwordHash: disHash,
      name: DISABLED_EMP.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      status: 'ENABLED',
      mustChangePassword: false,
    },
  });
  disabledId = dis.id;

  // Create test categories
  const cat = await prisma.knowledgeCategory.create({
    data: {
      name: `${PREFIX}测试分类`,
      description: '测试用分类',
      sortOrder: 99,
      isActive: true,
    },
  });
  testCategoryId = cat.id;

  const disCat = await prisma.knowledgeCategory.create({
    data: {
      name: `${PREFIX}停用分类`,
      description: '已停用的分类',
      sortOrder: 100,
      isActive: false,
    },
  });
  disabledCategoryId = disCat.id;

  // Login all users
  adminCookies = await loginAs(ADMIN_USER.username, ADMIN_USER.password);
  empACookies = await loginAs(EMPLOYEE_A.username, EMPLOYEE_A.password);
  empBCookies = await loginAs(EMPLOYEE_B.username, EMPLOYEE_B.password);
  mustChangeCookies = await loginAs(MUST_CHANGE_EMP.username, MUST_CHANGE_EMP.password);

  // Login disabled user (before disabling — we need cookies from a valid session)
  const disabledLoginRes = await request(app)
    .post('/api/v1/auth/sessions')
    .send({ username: DISABLED_EMP.username, password: DISABLED_EMP.password });
  disabledCookies = disabledLoginRes.headers['set-cookie'] || [];

  // Now disable the user (the cookie should be invalidated)
  await prisma.user.update({
    where: { id: disabledId },
    data: { status: 'DISABLED', tokenVersion: { increment: 1 } },
  });
});

// ============================================================
// Cleanup
// ============================================================

afterAll(async () => {
  // Delete test articles
  if (createdArticleIds.length > 0) {
    await prisma.knowledgeArticle.deleteMany({ where: { id: { in: createdArticleIds } } });
  }
  // Delete test categories
  await prisma.knowledgeCategory.deleteMany({ where: { name: { startsWith: PREFIX } } });
  // Delete test users
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } },
  });
  // Delete test department
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  await prisma.$disconnect();
});

// ============================================================
// Tests
// ============================================================

describe('知识分享模块', () => {
  // ----------------------------------------------------------
  // 1. Category list
  // ----------------------------------------------------------
  describe('GET /api/v1/knowledge/categories', () => {
    it('1. 获取分类列表 — 返回启用的分类', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/categories')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Should contain our active test category
      const names = res.body.data.map((c: any) => c.name);
      expect(names).toContain(`${PREFIX}测试分类`);
      // Should NOT contain disabled category
      expect(names).not.toContain(`${PREFIX}停用分类`);
    });
  });

  // ----------------------------------------------------------
  // 2-4. Create draft
  // ----------------------------------------------------------
  describe('POST /api/v1/knowledge/articles', () => {
    it('2. 创建草稿 — 成功', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}测试文章A`,
          summary: '这是摘要',
          content: '这是正文内容',
          categoryId: testCategoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(`${PREFIX}测试文章A`);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.authorId).toBe(empAId);
      createdArticleIds.push(res.body.data.id);
    });

    it('3. 创建时自动使用当前登录用户作为作者', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empBCookies.join('; '))
        .send({
          title: `${PREFIX}员工B的文章`,
          content: '正文内容',
          categoryId: testCategoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.authorId).toBe(empBId);
      createdArticleIds.push(res.body.data.id);
    });

    it('4a. 非法标题 — 过短', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: 'A',
          content: '正文',
          categoryId: testCategoryId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('4b. 非法正文 — 为空', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}合法标题`,
          content: '',
          categoryId: testCategoryId,
        });

      expect(res.status).toBe(400);
    });

    it('4c. 分类不存在或已停用', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}合法标题2`,
          content: '正文',
          categoryId: disabledCategoryId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KNOWLEDGE_CATEGORY_NOT_AVAILABLE');
    });

    it('4d. 分类ID不存在', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}合法标题3`,
          content: '正文',
          categoryId: 999999,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KNOWLEDGE_CATEGORY_NOT_AVAILABLE');
    });
  });

  // ----------------------------------------------------------
  // 5-6. Author sees draft, others don't
  // ----------------------------------------------------------
  describe('文章可见性', () => {
    let draftId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}草稿可见性测试`,
          content: '正文',
          categoryId: testCategoryId,
        });
      draftId = res.body.data.id;
      createdArticleIds.push(draftId);
    });

    it('5. 作者查看草稿 — 成功', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(draftId);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('6. 其他员工不能查看草稿 — 返回404', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empBCookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // 7-8. Update draft
  // ----------------------------------------------------------
  describe('修改文章', () => {
    let draftId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}待修改草稿`,
          content: '原始正文',
          categoryId: testCategoryId,
        });
      draftId = res.body.data.id;
      createdArticleIds.push(draftId);
    });

    it('7. 作者修改草稿 — 成功', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}已修改草稿`,
          content: '修改后的正文',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe(`${PREFIX}已修改草稿`);
      expect(res.body.data.content).toBe('修改后的正文');
    });

    it('8. 非作者不能修改 — 返回403', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empBCookies.join('; '))
        .send({
          title: `${PREFIX}越权修改`,
          content: '越权正文',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_FORBIDDEN');
    });
  });

  // ----------------------------------------------------------
  // 9-12. Publish and view published
  // ----------------------------------------------------------
  describe('发布文章', () => {
    let draftId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}待发布文章`,
          content: '将要发布的正文',
          categoryId: testCategoryId,
        });
      draftId = res.body.data.id;
      createdArticleIds.push(draftId);
    });

    it('9. 发布草稿 — 成功', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${draftId}/publish`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.publishedAt).not.toBeNull();
    });

    it('10. 所有有效员工查看已发布文章 — 成功', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empBCookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(draftId);
      expect(res.body.data.status).toBe('PUBLISHED');
    });

    it('11. 重复发布失败 — 409', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${draftId}/publish`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
    });

    it('12. 作者修改已发布文章 — 成功', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${draftId}`)
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}已修改的发布文章`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe(`${PREFIX}已修改的发布文章`);
      expect(res.body.data.status).toBe('PUBLISHED');
    });
  });

  // ----------------------------------------------------------
  // 13-16. Withdraw and visibility
  // ----------------------------------------------------------
  describe('撤回文章', () => {
    let articleId: number;

    beforeAll(async () => {
      // Create and publish
      const createRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}待撤回文章`,
          content: '正文',
          categoryId: testCategoryId,
        });
      articleId = createRes.body.data.id;
      createdArticleIds.push(articleId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${articleId}/publish`)
        .set('Cookie', empACookies.join('; '));
    });

    it('13. 作者撤回文章 — 成功', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${articleId}/withdraw`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('WITHDRAWN');
      expect(res.body.data.withdrawnAt).not.toBeNull();
    });

    it('14. 撤回后其他员工不能查看 — 返回404', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${articleId}`)
        .set('Cookie', empBCookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_NOT_FOUND');
    });

    it('15. 撤回后作者仍可查看', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${articleId}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('WITHDRAWN');
    });

    it('16a. 撤回文章不能修改 — 409', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${articleId}`)
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}尝试修改撤回文章` });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
    });

    it('16b. 撤回文章不能重新发布 — 409', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${articleId}/publish`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
    });
  });

  // ----------------------------------------------------------
  // 17. Non-author cannot publish or withdraw
  // ----------------------------------------------------------
  describe('非作者不能发布或撤回', () => {
    let draftId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}非作者操作测试`,
          content: '正文',
          categoryId: testCategoryId,
        });
      draftId = res.body.data.id;
      createdArticleIds.push(draftId);
    });

    it('17a. 非作者不能发布 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${draftId}/publish`)
        .set('Cookie', empBCookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_FORBIDDEN');
    });

    it('17b. 非作者不能撤回（草稿） — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${draftId}/withdraw`)
        .set('Cookie', empBCookies.join('; '));

      expect(res.status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 18-21. Search, filter, pagination
  // ----------------------------------------------------------
  describe('搜索、筛选和分页', () => {
    beforeAll(async () => {
      // Create and publish several articles for search/filter testing
      const articles = [
        { title: `${PREFIX}Alpha技术分享`, catId: testCategoryId },
        { title: `${PREFIX}Beta操作指南`, catId: testCategoryId },
        { title: `${PREFIX}Gamma工作总结`, catId: testCategoryId },
      ];

      for (const a of articles) {
        const res = await request(app)
          .post('/api/v1/knowledge/articles')
          .set('Cookie', empACookies.join('; '))
          .send({ title: a.title, content: '搜索测试正文', categoryId: a.catId });
        createdArticleIds.push(res.body.data.id);

        await request(app)
          .post(`/api/v1/knowledge/articles/${res.body.data.id}/publish`)
          .set('Cookie', empACookies.join('; '));
      }
    });

    it('18. 标题搜索', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles?keyword=${encodeURIComponent(PREFIX + 'Alpha')}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].title).toContain('Alpha');
    });

    it('19. 分类筛选', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles?categoryId=${testCategoryId}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      res.body.data.items.forEach((item: any) => {
        expect(item.categoryId).toBe(testCategoryId);
      });
    });

    it('20. 状态筛选 — 我的文章', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/me/articles?status=DRAFT`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      res.body.data.items.forEach((item: any) => {
        expect(item.status).toBe('DRAFT');
        expect(item.authorId).toBe(empAId);
      });
    });

    it('21. 分页 items、total、totalPages 正确', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles?page=1&pageSize=2`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.pageSize).toBe(2);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.totalPages).toBe(
        Math.ceil(res.body.data.pagination.total / 2)
      );
    });
  });

  // ----------------------------------------------------------
  // 22. Invalid ID returns 400
  // ----------------------------------------------------------
  describe('非法 ID', () => {
    it('22. 非法 ID 返回 400', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles/abc')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------
  // 23. Unauthenticated returns 401
  // ----------------------------------------------------------
  describe('未登录访问', () => {
    it('23. 未登录返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles');

      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // 24. Must-change-password returns 403
  // ----------------------------------------------------------
  describe('强制改密用户', () => {
    it('24. 强制改密用户返回 403', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', mustChangeCookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });
  });

  // ----------------------------------------------------------
  // 25. Admin returns 403
  // ----------------------------------------------------------
  describe('管理员访问', () => {
    it('25. 管理员访问返回 403', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', adminCookies.join('; '));

      expect(res.status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 26. Disabled employee returns 401
  // ----------------------------------------------------------
  describe('停用员工', () => {
    it('26. 停用员工原会话访问返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', disabledCookies.join('; '));

      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // 27. Concurrent publish/withdraw — only one succeeds
  // ----------------------------------------------------------
  describe('条件更新的并发安全', () => {
    it('27. 重复发布请求只有一个成功', async () => {
      // Create a draft
      const createRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}并发发布测试`,
          content: '正文',
          categoryId: testCategoryId,
        });
      const articleId = createRes.body.data.id;
      createdArticleIds.push(articleId);

      // Send two publish requests concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/knowledge/articles/${articleId}/publish`)
          .set('Cookie', empACookies.join('; ')),
        request(app)
          .post(`/api/v1/knowledge/articles/${articleId}/publish`)
          .set('Cookie', empACookies.join('; ')),
      ]);

      // One should succeed (200), the other should fail (409)
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);
    });
  });

  // ----------------------------------------------------------
  // My articles list
  // ----------------------------------------------------------
  describe('GET /api/v1/knowledge/me/articles', () => {
    it('我的文章列表 — 只返回自己的文章', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/me/articles')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      res.body.data.items.forEach((item: any) => {
        expect(item.authorId).toBe(empAId);
      });
    });

    it('我的文章 — 包含所有状态', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/me/articles')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      const statuses = res.body.data.items.map((i: any) => i.status);
      // Should have at least DRAFT and PUBLISHED (from previous tests)
      expect(statuses).toContain('DRAFT');
    });
  });

  // ----------------------------------------------------------
  // Edge: article not found
  // ----------------------------------------------------------
  describe('文章不存在', () => {
    it('访问不存在的文章返回 404', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles/999999')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_NOT_FOUND');
    });
  });
});
