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
const PREFIX = `[kc_${RUN_ID}]`;

// ============================================================
// Test Data
// ============================================================

const ADMIN_USER = {
  username: `kc_admin_${RUN_ID}`,
  password: 'AdminTest123',
  name: `${PREFIX}管理员`,
};

const EMPLOYEE_A = {
  username: `kc_emp_a_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工A`,
};

const EMPLOYEE_B = {
  username: `kc_emp_b_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工B`,
};

const MUST_CHANGE_EMP = {
  username: `kc_mc_${RUN_ID}`,
  password: 'MustChange123',
  name: `${PREFIX}强制改密`,
};

const DISABLED_EMP = {
  username: `kc_disabled_${RUN_ID}`,
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

// Track all IDs created by this test for cleanup
const createdArticleIds: number[] = [];
const createdCategoryIds: number[] = [];
const createdCommentIds: number[] = [];

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
  await prisma.knowledgeModerationLog.deleteMany({
    where: { operator: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } } },
  });
  await prisma.knowledgeArticleLike.deleteMany({
    where: { user: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } } },
  });
  await prisma.knowledgeArticleFavorite.deleteMany({
    where: { user: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } } },
  });
  await prisma.knowledgeComment.deleteMany({
    where: { author: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username, DISABLED_EMP.username] } } },
  });
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

  // Disabled employee
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

  // Login disabled user (before disabling)
  const disabledLoginRes = await request(app)
    .post('/api/v1/auth/sessions')
    .send({ username: DISABLED_EMP.username, password: DISABLED_EMP.password });
  disabledCookies = disabledLoginRes.headers['set-cookie'] || [];

  // Now disable the user
  await prisma.user.update({
    where: { id: disabledId },
    data: { status: 'DISABLED', tokenVersion: { increment: 1 } },
  });
});

// ============================================================
// Cleanup
// ============================================================

afterAll(async () => {
  // Delete moderation logs for our test articles
  if (createdArticleIds.length > 0) {
    await prisma.knowledgeModerationLog.deleteMany({ where: { articleId: { in: createdArticleIds } } });
  }
  // Delete likes/favorites for our test articles
  if (createdArticleIds.length > 0) {
    await prisma.knowledgeArticleLike.deleteMany({ where: { articleId: { in: createdArticleIds } } });
    await prisma.knowledgeArticleFavorite.deleteMany({ where: { articleId: { in: createdArticleIds } } });
  }
  // Delete comments for our test articles
  if (createdArticleIds.length > 0) {
    await prisma.knowledgeComment.deleteMany({ where: { articleId: { in: createdArticleIds } } });
  }
  // Delete test articles
  if (createdArticleIds.length > 0) {
    await prisma.knowledgeArticle.deleteMany({ where: { id: { in: createdArticleIds } } });
  }
  // Delete test categories (including ones created during tests)
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

describe('知识社区模块', () => {

  // ==========================================================
  // Shared article IDs used across test groups
  // ==========================================================
  let publishedArticleId: number;   // empA creates, PUBLISHED
  let draftArticleId: number;       // empA creates, DRAFT
  let withdrawnArticleId: number;   // empA creates, WITHDRAWN
  let takenDownArticleId: number;   // empA creates, TAKEN_DOWN (by admin)
  let pendingReviewArticleId: number; // empA creates, PENDING_REVIEW
  let empBArticleId: number;        // empB creates, PUBLISHED

  // ==========================================================
  // Phase 0: Create test articles in various states
  // ==========================================================
  describe('准备测试文章', () => {
    it('创建并发布文章 (empA) — PUBLISHED', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}已发布文章`,
          content: '这是已发布的正文内容',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      publishedArticleId = res.body.data.id;
      createdArticleIds.push(publishedArticleId);

      const pubRes = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/publish`)
        .set('Cookie', empACookies.join('; '));
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('PUBLISHED');
    });

    it('创建草稿文章 (empA) — DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}草稿文章`,
          content: '草稿正文',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      draftArticleId = res.body.data.id;
      createdArticleIds.push(draftArticleId);
    });

    it('创建并撤回文章 (empA) — WITHDRAWN', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}待撤回文章`,
          content: '将要撤回的正文',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      withdrawnArticleId = res.body.data.id;
      createdArticleIds.push(withdrawnArticleId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${withdrawnArticleId}/publish`)
        .set('Cookie', empACookies.join('; '));

      const wdRes = await request(app)
        .post(`/api/v1/knowledge/articles/${withdrawnArticleId}/withdraw`)
        .set('Cookie', empACookies.join('; '));
      expect(wdRes.status).toBe(200);
      expect(wdRes.body.data.status).toBe('WITHDRAWN');
    });

    it('创建文章后由管理员下架 (empA) — TAKEN_DOWN', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}将被下架文章`,
          content: '将被下架的正文',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      takenDownArticleId = res.body.data.id;
      createdArticleIds.push(takenDownArticleId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${takenDownArticleId}/publish`)
        .set('Cookie', empACookies.join('; '));

      const tdRes = await request(app)
        .post(`/api/v1/admin/knowledge/articles/${takenDownArticleId}/take-down`)
        .set('Cookie', adminCookies.join('; '))
        .send({ reason: '测试下架原因' });
      expect(tdRes.status).toBe(200);
      expect(tdRes.body.data.status).toBe('TAKEN_DOWN');
    });

    it('创建文章后下架再提交复审 (empA) — PENDING_REVIEW', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}待审核文章`,
          content: '待审核正文',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      pendingReviewArticleId = res.body.data.id;
      createdArticleIds.push(pendingReviewArticleId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${pendingReviewArticleId}/publish`)
        .set('Cookie', empACookies.join('; '));

      await request(app)
        .post(`/api/v1/admin/knowledge/articles/${pendingReviewArticleId}/take-down`)
        .set('Cookie', adminCookies.join('; '))
        .send({ reason: '下架后提交复审' });

      const srRes = await request(app)
        .post(`/api/v1/knowledge/articles/${pendingReviewArticleId}/submit-review`)
        .set('Cookie', empACookies.join('; '));
      expect(srRes.status).toBe(200);
      expect(srRes.body.data.status).toBe('PENDING_REVIEW');
    });

    it('创建并发布文章 (empB) — PUBLISHED', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empBCookies.join('; '))
        .send({
          title: `${PREFIX}员工B的发布文章`,
          content: '员工B的正文',
          categoryId: testCategoryId,
        });
      expect(res.status).toBe(201);
      empBArticleId = res.body.data.id;
      createdArticleIds.push(empBArticleId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${empBArticleId}/publish`)
        .set('Cookie', empBCookies.join('; '));
    });
  });

  // ==========================================================
  // Phase 1: Comment Tests
  // ==========================================================
  describe('评论功能', () => {
    let commentIdByA: number;
    let commentIdByB: number;

    it('在已发布文章上发表评论 — 成功', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: '这是一条测试评论' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('这是一条测试评论');
      expect(res.body.data.author.id).toBe(empAId);
      expect(res.body.data.isDeleted).toBe(false);
      commentIdByA = res.body.data.id;
      createdCommentIds.push(commentIdByA);
    });

    it('员工B也在同一篇文章上评论', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empBCookies.join('; '))
        .send({ content: '员工B的评论' });

      expect(res.status).toBe(201);
      expect(res.body.data.author.id).toBe(empBId);
      commentIdByB = res.body.data.id;
      createdCommentIds.push(commentIdByB);
    });

    it('空内容评论 — 400', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('纯空白内容评论 — 400', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('超过1000字符的评论 — 400', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: 'a'.repeat(1001) });

      expect(res.status).toBe(400);
    });

    it('正好1000字符的评论 — 成功', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: 'b'.repeat(1000) });

      expect(res.status).toBe(201);
      createdCommentIds.push(res.body.data.id);
    });

    it('获取评论列表 — 包含自己的评论', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      const contents = res.body.data.items
        .filter((c: any) => !c.isDeleted)
        .map((c: any) => c.content);
      expect(contents).toContain('这是一条测试评论');
      expect(contents).toContain('员工B的评论');
    });

    it('评论分页正确', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${publishedArticleId}/comments?page=1&pageSize=2`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.pageSize).toBe(2);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('删除自己的评论 — 成功（软删除）', async () => {
      const res = await request(app)
        .delete(`/api/v1/knowledge/comments/${commentIdByA}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('重复删除同一评论 — 409', async () => {
      const res = await request(app)
        .delete(`/api/v1/knowledge/comments/${commentIdByA}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('KNOWLEDGE_COMMENT_ALREADY_DELETED');
    });

    it('其他用户不能删除他人评论 — 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/knowledge/comments/${commentIdByB}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KNOWLEDGE_COMMENT_FORBIDDEN');
    });

    it('文章作者也不能删除他人评论 — 403', async () => {
      // empA is the article author, trying to delete empB's comment
      const res = await request(app)
        .delete(`/api/v1/knowledge/comments/${commentIdByB}`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('KNOWLEDGE_COMMENT_FORBIDDEN');
    });

    it('已删除评论在列表中显示为已删除，不返回内容', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(200);
      const deletedComment = res.body.data.items.find((c: any) => c.id === commentIdByA);
      expect(deletedComment).toBeDefined();
      expect(deletedComment.isDeleted).toBe(true);
      expect(deletedComment.content).toBeNull();
      expect(deletedComment.deletedAt).not.toBeNull();
    });

    it('管理员删除评论（附带原因） — 成功', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/knowledge/comments/${commentIdByB}`)
        .set('Cookie', adminCookies.join('; '))
        .send({ reason: '评论内容不当' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('管理员删除后验证审核日志已创建', async () => {
      const log = await prisma.knowledgeModerationLog.findFirst({
        where: {
          articleId: publishedArticleId,
          action: 'COMMENT_REMOVED',
          operatorId: adminId,
        },
        orderBy: { id: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log!.reason).toBe('评论内容不当');
    });

    it('在草稿文章上评论 — 失败', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${draftArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: '草稿评论' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
    });

    it('在已撤回文章上评论 — 失败', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${withdrawnArticleId}/comments`)
        .set('Cookie', empACookies.join('; '))
        .send({ content: '撤回评论' });

      // Non-author sees 404, author sees state error
      expect([400, 404]).toContain(res.status);
    });

    it('访问不存在的文章评论 — 404', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles/999999/comments')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_NOT_FOUND');
    });

    it('删除不存在的评论 — 404', async () => {
      const res = await request(app)
        .delete('/api/v1/knowledge/comments/999999')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KNOWLEDGE_COMMENT_NOT_FOUND');
    });
  });

  // ==========================================================
  // Phase 2: Like & Favorite Tests
  // ==========================================================
  describe('点赞与收藏功能', () => {

    // ---- Likes ----
    describe('点赞', () => {
      it('点赞文章 — 成功，liked=true, likeCount=1', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.liked).toBe(true);
        expect(res.body.data.likeCount).toBeGreaterThanOrEqual(1);
      });

      it('重复点赞同一文章 — 幂等（likeCount不变）', async () => {
        const beforeRes = await request(app)
          .get(`/api/v1/knowledge/articles/${publishedArticleId}`)
          .set('Cookie', empACookies.join('; '));
        const countBefore = beforeRes.body.data.likeCount;

        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.liked).toBe(true);
        expect(res.body.data.likeCount).toBe(countBefore);
      });

      it('取消点赞 — 成功，liked=false, likeCount减1', async () => {
        const res = await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.liked).toBe(false);
      });

      it('未点赞时取消点赞 — 幂等（likeCount=0）', async () => {
        const res = await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.liked).toBe(false);
        expect(res.body.data.likeCount).toBe(0);
      });

      it('不能点赞草稿文章 — 404', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${draftArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(404);
      });

      it('不能点赞已撤回文章 — 404', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${withdrawnArticleId}/like`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(404);
      });

      it('停用员工不能点赞 — 401', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', disabledCookies.join('; '));

        expect(res.status).toBe(401);
      });
    });

    // ---- Favorites ----
    describe('收藏', () => {
      it('收藏文章 — 成功，favorited=true', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.favorited).toBe(true);
      });

      it('重复收藏同一文章 — 幂等', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.favorited).toBe(true);
      });

      it('取消收藏 — 成功，favorited=false', async () => {
        const res = await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.favorited).toBe(false);
      });

      it('未收藏时取消收藏 — 幂等', async () => {
        const res = await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.favorited).toBe(false);
      });

      it('不能收藏草稿文章 — 404', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${draftArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(404);
      });

      it('不能收藏已撤回文章 — 404', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${withdrawnArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(404);
      });

      it('停用员工不能收藏 — 401', async () => {
        const res = await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', disabledCookies.join('; '));

        expect(res.status).toBe(401);
      });
    });

    // ---- Article detail includes interaction data ----
    describe('文章详情包含互动数据', () => {
      it('文章详情包含 likeCount, commentCount, likedByMe, favoritedByMe', async () => {
        // First, like and favorite the article
        await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empBCookies.join('; '));
        await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empBCookies.join('; '));

        const res = await request(app)
          .get(`/api/v1/knowledge/articles/${publishedArticleId}`)
          .set('Cookie', empBCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.likeCount).toBeGreaterThanOrEqual(1);
        expect(res.body.data.commentCount).toBeGreaterThanOrEqual(0);
        expect(res.body.data.likedByMe).toBe(true);
        expect(res.body.data.favoritedByMe).toBe(true);

        // Cleanup: unlike and unfavorite
        await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
          .set('Cookie', empBCookies.join('; '));
        await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empBCookies.join('; '));
      });

      it('未点赞/收藏时 likedByMe=false, favoritedByMe=false', async () => {
        const res = await request(app)
          .get(`/api/v1/knowledge/articles/${publishedArticleId}`)
          .set('Cookie', empBCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.likedByMe).toBe(false);
        expect(res.body.data.favoritedByMe).toBe(false);
      });
    });

    // ---- My favorites list ----
    describe('我的收藏列表', () => {
      it('收藏后出现在我的收藏列表中', async () => {
        // Favorite the article
        await request(app)
          .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));

        const res = await request(app)
          .get('/api/v1/knowledge/me/favorites')
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.items)).toBe(true);
        const articleIds = res.body.data.items
          .filter((f: any) => f.available)
          .map((f: any) => f.article.id);
        expect(articleIds).toContain(publishedArticleId);

        // Cleanup
        await request(app)
          .delete(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
          .set('Cookie', empACookies.join('; '));
      });

      it('取消收藏后不在列表中', async () => {
        const res = await request(app)
          .get('/api/v1/knowledge/me/favorites')
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        const articleIds = res.body.data.items
          .filter((f: any) => f.available)
          .map((f: any) => f.article.id);
        expect(articleIds).not.toContain(publishedArticleId);
      });
    });
  });

  // ==========================================================
  // Phase 3: Admin Moderation Tests
  // ==========================================================
  describe('管理员审核功能', () => {

    // ---- Admin article list ----
    describe('管理员文章列表', () => {
      it('管理员列表只返回 PUBLISHED, TAKEN_DOWN, PENDING_REVIEW', async () => {
        const res = await request(app)
          .get('/api/v1/admin/knowledge/articles')
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const statuses = res.body.data.items.map((a: any) => a.status);
        statuses.forEach((s: string) => {
          expect(['PUBLISHED', 'TAKEN_DOWN', 'PENDING_REVIEW']).toContain(s);
        });
        // Should NOT contain DRAFT or WITHDRAWN
        expect(statuses).not.toContain('DRAFT');
        expect(statuses).not.toContain('WITHDRAWN');
      });

      it('管理员文章列表包含我们的测试文章', async () => {
        const res = await request(app)
          .get(`/api/v1/admin/knowledge/articles?keyword=${encodeURIComponent(PREFIX)}`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        const ids = res.body.data.items.map((a: any) => a.id);
        expect(ids).toContain(publishedArticleId);
      });
    });

    // ---- Admin article detail ----
    describe('管理员文章详情', () => {
      it('管理员查看已发布文章详情 — 成功', async () => {
        const res = await request(app)
          .get(`/api/v1/admin/knowledge/articles/${publishedArticleId}`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(publishedArticleId);
        expect(res.body.data.status).toBe('PUBLISHED');
        expect(res.body.data.content).toBeDefined();
      });

      it('管理员查看TAKEN_DOWN文章详情 — 成功', async () => {
        const res = await request(app)
          .get(`/api/v1/admin/knowledge/articles/${takenDownArticleId}`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('TAKEN_DOWN');
      });

      it('管理员查看DRAFT文章详情 — 404', async () => {
        const res = await request(app)
          .get(`/api/v1/admin/knowledge/articles/${draftArticleId}`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(404);
      });

      it('管理员查看WITHDRAWN文章详情 — 404', async () => {
        const res = await request(app)
          .get(`/api/v1/admin/knowledge/articles/${withdrawnArticleId}`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(404);
      });
    });

    // ---- Take down ----
    describe('下架文章', () => {
      let articleToTakeDown: number;

      beforeAll(async () => {
        // Create and publish a fresh article for take-down testing
        const res = await request(app)
          .post('/api/v1/knowledge/articles')
          .set('Cookie', empACookies.join('; '))
          .send({
            title: `${PREFIX}下架测试文章`,
            content: '下架测试正文',
            categoryId: testCategoryId,
          });
        articleToTakeDown = res.body.data.id;
        createdArticleIds.push(articleToTakeDown);

        await request(app)
          .post(`/api/v1/knowledge/articles/${articleToTakeDown}/publish`)
          .set('Cookie', empACookies.join('; '));
      });

      it('管理员下架已发布文章 — 成功', async () => {
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${articleToTakeDown}/take-down`)
          .set('Cookie', adminCookies.join('; '))
          .send({ reason: '违反社区规范' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('TAKEN_DOWN');
      });

      it('下架后生成审核日志', async () => {
        const log = await prisma.knowledgeModerationLog.findFirst({
          where: {
            articleId: articleToTakeDown,
            action: 'TAKE_DOWN',
            operatorId: adminId,
          },
          orderBy: { id: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log!.reason).toBe('违反社区规范');
        expect(log!.articleStatusBefore).toBe('PUBLISHED');
        expect(log!.articleStatusAfter).toBe('TAKEN_DOWN');
      });

      it('重复下架已下架文章 — 409', async () => {
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${articleToTakeDown}/take-down`)
          .set('Cookie', adminCookies.join('; '))
          .send({ reason: '再次下架' });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });

      it('普通员工不能下架 — 403', async () => {
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${publishedArticleId}/take-down`)
          .set('Cookie', empACookies.join('; '))
          .send({ reason: '越权下架' });

        expect(res.status).toBe(403);
      });
    });

    // ---- Submit review (TAKEN_DOWN → PENDING_REVIEW) ----
    describe('提交复审', () => {
      it('作者提交被下架文章复审 — 成功', async () => {
        // takenDownArticleId is already TAKEN_DOWN
        const res = await request(app)
          .post(`/api/v1/knowledge/articles/${takenDownArticleId}/submit-review`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('PENDING_REVIEW');
      });

      it('提交复审后生成审核日志', async () => {
        const log = await prisma.knowledgeModerationLog.findFirst({
          where: {
            articleId: takenDownArticleId,
            action: 'REVIEW_SUBMITTED',
          },
          orderBy: { id: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log!.articleStatusBefore).toBe('TAKEN_DOWN');
        expect(log!.articleStatusAfter).toBe('PENDING_REVIEW');
      });

      it('非TAKEN_DOWN状态提交复审 — 409', async () => {
        // publishedArticleId is PUBLISHED, not TAKEN_DOWN
        const res = await request(app)
          .post(`/api/v1/knowledge/articles/${publishedArticleId}/submit-review`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });

      it('非作者不能提交复审 — 403', async () => {
        // empB tries to submit empA's article
        const res = await request(app)
          .post(`/api/v1/knowledge/articles/${takenDownArticleId}/submit-review`)
          .set('Cookie', empBCookies.join('; '));

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_FORBIDDEN');
      });
    });

    // ---- Approve review (PENDING_REVIEW → PUBLISHED) ----
    describe('审核通过', () => {
      it('管理员审核通过 — 成功', async () => {
        // takenDownArticleId was submitted for review above → PENDING_REVIEW
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${takenDownArticleId}/review/approve`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('PUBLISHED');
      });

      it('审核通过后生成审核日志', async () => {
        const log = await prisma.knowledgeModerationLog.findFirst({
          where: {
            articleId: takenDownArticleId,
            action: 'RESTORE_APPROVED',
          },
          orderBy: { id: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log!.articleStatusBefore).toBe('PENDING_REVIEW');
        expect(log!.articleStatusAfter).toBe('PUBLISHED');
      });

      it('非PENDING_REVIEW状态审核通过 — 409', async () => {
        // publishedArticleId is PUBLISHED, not PENDING_REVIEW
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${publishedArticleId}/review/approve`)
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });
    });

    // ---- Reject review (PENDING_REVIEW → TAKEN_DOWN) ----
    describe('审核拒绝', () => {
      // Need a fresh PENDING_REVIEW article for rejection
      let rejectTargetId: number;

      beforeAll(async () => {
        const res = await request(app)
          .post('/api/v1/knowledge/articles')
          .set('Cookie', empACookies.join('; '))
          .send({
            title: `${PREFIX}将被拒绝的文章`,
            content: '拒绝测试正文',
            categoryId: testCategoryId,
          });
        rejectTargetId = res.body.data.id;
        createdArticleIds.push(rejectTargetId);

        await request(app)
          .post(`/api/v1/knowledge/articles/${rejectTargetId}/publish`)
          .set('Cookie', empACookies.join('; '));

        await request(app)
          .post(`/api/v1/admin/knowledge/articles/${rejectTargetId}/take-down`)
          .set('Cookie', adminCookies.join('; '))
          .send({ reason: '下架' });

        await request(app)
          .post(`/api/v1/knowledge/articles/${rejectTargetId}/submit-review`)
          .set('Cookie', empACookies.join('; '));
      });

      it('管理员审核拒绝 — 成功', async () => {
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${rejectTargetId}/review/reject`)
          .set('Cookie', adminCookies.join('; '))
          .send({ reason: '内容不符合要求' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('TAKEN_DOWN');
      });

      it('审核拒绝后生成审核日志', async () => {
        const log = await prisma.knowledgeModerationLog.findFirst({
          where: {
            articleId: rejectTargetId,
            action: 'RESTORE_REJECTED',
          },
          orderBy: { id: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log!.reason).toBe('内容不符合要求');
        expect(log!.articleStatusBefore).toBe('PENDING_REVIEW');
        expect(log!.articleStatusAfter).toBe('TAKEN_DOWN');
      });

      it('非PENDING_REVIEW状态审核拒绝 — 409', async () => {
        const res = await request(app)
          .post(`/api/v1/admin/knowledge/articles/${publishedArticleId}/review/reject`)
          .set('Cookie', adminCookies.join('; '))
          .send({ reason: '拒绝原因' });

        expect(res.status).toBe(409);
      });
    });

    // ---- PENDING_REVIEW article restrictions ----
    describe('PENDING_REVIEW 文章限制', () => {
      it('PENDING_REVIEW 文章：作者不能编辑 — 409', async () => {
        const res = await request(app)
          .patch(`/api/v1/knowledge/articles/${pendingReviewArticleId}`)
          .set('Cookie', empACookies.join('; '))
          .send({ title: `${PREFIX}尝试编辑待审核` });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });

      it('PENDING_REVIEW 文章：作者不能发布 — 409', async () => {
        const res = await request(app)
          .post(`/api/v1/knowledge/articles/${pendingReviewArticleId}/publish`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });

      it('PENDING_REVIEW 文章：作者不能撤回 — 409', async () => {
        const res = await request(app)
          .post(`/api/v1/knowledge/articles/${pendingReviewArticleId}/withdraw`)
          .set('Cookie', empACookies.join('; '));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED');
      });
    });

    // ---- Admin category CRUD ----
    describe('管理员分类管理', () => {
      let newCatId: number;

      it('创建新分类 — 成功', async () => {
        const res = await request(app)
          .post('/api/v1/admin/knowledge/categories')
          .set('Cookie', adminCookies.join('; '))
          .send({
            name: `${PREFIX}新建分类`,
            description: '新建分类描述',
            sortOrder: 50,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe(`${PREFIX}新建分类`);
        expect(res.body.data.sortOrder).toBe(50);
        expect(res.body.data.isActive).toBe(true);
        newCatId = res.body.data.id;
        createdCategoryIds.push(newCatId);
      });

      it('管理员列表包含所有分类（含停用）', async () => {
        const res = await request(app)
          .get('/api/v1/admin/knowledge/categories')
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        const names = res.body.data.map((c: any) => c.name);
        expect(names).toContain(`${PREFIX}测试分类`);
        expect(names).toContain(`${PREFIX}停用分类`);
        expect(names).toContain(`${PREFIX}新建分类`);
      });

      it('更新分类名称 — 成功', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/knowledge/categories/${newCatId}`)
          .set('Cookie', adminCookies.join('; '))
          .send({ name: `${PREFIX}已更新分类` });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe(`${PREFIX}已更新分类`);
      });

      it('停用分类 — 成功', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/knowledge/categories/${newCatId}`)
          .set('Cookie', adminCookies.join('; '))
          .send({ isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.data.isActive).toBe(false);
      });

      it('重新启用分类 — 成功', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/knowledge/categories/${newCatId}`)
          .set('Cookie', adminCookies.join('; '))
          .send({ isActive: true });

        expect(res.status).toBe(200);
        expect(res.body.data.isActive).toBe(true);
      });

      it('分类名称重复 — 409', async () => {
        const res = await request(app)
          .post('/api/v1/admin/knowledge/categories')
          .set('Cookie', adminCookies.join('; '))
          .send({
            name: `${PREFIX}测试分类`, // already exists
            description: '重复名称',
          });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_CATEGORY_NAME_EXISTS');
      });

      it('更新分类为重复名称 — 409', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/knowledge/categories/${newCatId}`)
          .set('Cookie', adminCookies.join('; '))
          .send({ name: `${PREFIX}测试分类` }); // already exists

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('KNOWLEDGE_CATEGORY_NAME_EXISTS');
      });

      it('不能用停用分类创建文章 — 400', async () => {
        const res = await request(app)
          .post('/api/v1/knowledge/articles')
          .set('Cookie', empACookies.join('; '))
          .send({
            title: `${PREFIX}停用分类文章`,
            content: '正文',
            categoryId: disabledCategoryId,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('KNOWLEDGE_CATEGORY_NOT_AVAILABLE');
      });

      it('更新不存在的分类 — 404', async () => {
        const res = await request(app)
          .put('/api/v1/admin/knowledge/categories/999999')
          .set('Cookie', adminCookies.join('; '))
          .send({ name: `${PREFIX}不存在` });

        expect(res.status).toBe(404);
      });
    });

    // ---- Admin comment list ----
    describe('管理员评论列表', () => {
      it('管理员可以查看评论列表', async () => {
        const res = await request(app)
          .get('/api/v1/admin/knowledge/comments')
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.pagination).toBeDefined();
      });

      it('管理员评论列表包含文章和作者信息', async () => {
        const res = await request(app)
          .get('/api/v1/admin/knowledge/comments')
          .set('Cookie', adminCookies.join('; '));

        expect(res.status).toBe(200);
        if (res.body.data.items.length > 0) {
          const comment = res.body.data.items[0];
          expect(comment.article).toBeDefined();
          expect(comment.article.id).toBeDefined();
          expect(comment.article.title).toBeDefined();
          expect(comment.author).toBeDefined();
          expect(comment.author.id).toBeDefined();
          expect(comment.author.name).toBeDefined();
        }
      });
    });
  });

  // ==========================================================
  // Phase 4: Auth / Permission Tests
  // ==========================================================
  describe('认证与权限', () => {
    it('未登录访问知识接口 — 401', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles');

      expect(res.status).toBe(401);
    });

    it('未登录访问评论接口 — 401', async () => {
      const res = await request(app)
        .get(`/api/v1/knowledge/articles/${publishedArticleId}/comments`);

      expect(res.status).toBe(401);
    });

    it('未登录访问点赞接口 — 401', async () => {
      const res = await request(app)
        .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`);

      expect(res.status).toBe(401);
    });

    it('未登录访问管理员接口 — 401', async () => {
      const res = await request(app)
        .get('/api/v1/admin/knowledge/articles');

      expect(res.status).toBe(401);
    });

    it('强制改密用户访问知识接口 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', mustChangeCookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('强制改密用户发表评论 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', mustChangeCookies.join('; '))
        .send({ content: '强制改密用户评论' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('强制改密用户点赞 — 403', async () => {
      const res = await request(app)
        .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
        .set('Cookie', mustChangeCookies.join('; '));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('停用员工访问知识接口 — 401', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', disabledCookies.join('; '));

      expect(res.status).toBe(401);
    });

    it('停用员工发表评论 — 401', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', disabledCookies.join('; '))
        .send({ content: '停用用户评论' });

      expect(res.status).toBe(401);
    });

    it('普通员工访问管理员接口 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/knowledge/articles')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('普通员工访问管理员分类接口 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/knowledge/categories')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('普通员工访问管理员评论接口 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/knowledge/comments')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('普通员工不能下架文章 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/knowledge/articles/${publishedArticleId}/take-down`)
        .set('Cookie', empACookies.join('; '))
        .send({ reason: '越权' });

      expect(res.status).toBe(403);
    });

    it('普通员工不能审核通过 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/knowledge/articles/${pendingReviewArticleId}/review/approve`)
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('普通员工不能审核拒绝 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/knowledge/articles/${pendingReviewArticleId}/review/reject`)
        .set('Cookie', empACookies.join('; '))
        .send({ reason: '越权拒绝' });

      expect(res.status).toBe(403);
    });

    it('管理员不能访问员工知识列表 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles')
        .set('Cookie', adminCookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('管理员不能发表评论 — 403', async () => {
      const res = await request(app)
        .post(`/api/v1/knowledge/articles/${publishedArticleId}/comments`)
        .set('Cookie', adminCookies.join('; '))
        .send({ content: '管理员评论' });

      expect(res.status).toBe(403);
    });

    it('管理员不能点赞 — 403', async () => {
      const res = await request(app)
        .put(`/api/v1/knowledge/articles/${publishedArticleId}/like`)
        .set('Cookie', adminCookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('管理员不能收藏 — 403', async () => {
      const res = await request(app)
        .put(`/api/v1/knowledge/articles/${publishedArticleId}/favorite`)
        .set('Cookie', adminCookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('强制改密用户访问管理员接口 — 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/knowledge/articles')
        .set('Cookie', mustChangeCookies.join('; '));

      expect(res.status).toBe(403);
    });

    it('非法ID返回400', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge/articles/abc/comments')
        .set('Cookie', empACookies.join('; '));

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================
  // Phase 5: Rate Limiting
  // ==========================================================
  describe('AI限流', () => {
    it('短时间内多次AI请求触发限流 — 400', async () => {
      // Test rate limiting at the service level using mock provider
      // to avoid consuming real API calls
      const { AiService } = await import('../src/modules/knowledge/ai/ai.service');
      const { createMockProvider } = await import('../src/modules/knowledge/ai/ai-provider');
      const service = new AiService(createMockProvider());

      // Send 10 requests (should succeed)
      for (let i = 0; i < 10; i++) {
        const result = await service.generateDraft(99999, { topic: `test${i}` });
        expect(result.content).toBeDefined();
      }

      // 11th request should be rate limited
      await expect(service.generateDraft(99999, { topic: 'overflow' })).rejects.toThrow('AI请求过于频繁');
    });
  });

  // ==========================================================
  // Phase 6: Article status restrictions for editing
  // ==========================================================
  describe('文章状态与编辑限制', () => {
    it('TAKEN_DOWN 文章：作者可以编辑', async () => {
      // takenDownArticleId was taken down, author can still edit
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${takenDownArticleId}`)
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}已下架后编辑` });

      expect(res.status).toBe(200);
    });

    it('PUBLISHED 文章：作者可以编辑', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${publishedArticleId}`)
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}已发布后编辑` });

      expect(res.status).toBe(200);
    });

    it('DRAFT 文章：作者可以编辑', async () => {
      const res = await request(app)
        .patch(`/api/v1/knowledge/articles/${draftArticleId}`)
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}草稿编辑` });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================================
  // Phase 7: True Concurrent Tests (Promise.all)
  // ==========================================================
  describe('并发操作（Promise.all）', () => {
    it('并发点赞同一文章 — 不产生重复记录', async () => {
      // Create a fresh article for concurrent testing
      const artRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}并发点赞测试`, content: '并发测试', categoryId: testCategoryId });
      const artId = artRes.body.data.id;
      createdArticleIds.push(artId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${artId}/publish`)
        .set('Cookie', empACookies.join('; '));

      // Concurrent likes from empA and empB
      const [resA, resB] = await Promise.all([
        request(app).put(`/api/v1/knowledge/articles/${artId}/like`).set('Cookie', empACookies.join('; ')),
        request(app).put(`/api/v1/knowledge/articles/${artId}/like`).set('Cookie', empBCookies.join('; ')),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Verify exactly 2 likes in DB
      const likeCount = await prisma.knowledgeArticleLike.count({ where: { articleId: artId } });
      expect(likeCount).toBe(2);
    });

    it('同一用户并发点赞同一文章 — 幂等不重复', async () => {
      const artRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}并发幂等点赞`, content: '并发测试', categoryId: testCategoryId });
      const artId = artRes.body.data.id;
      createdArticleIds.push(artId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${artId}/publish`)
        .set('Cookie', empACookies.join('; '));

      // Same user sends 5 concurrent likes
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).put(`/api/v1/knowledge/articles/${artId}/like`).set('Cookie', empACookies.join('; '))
        )
      );

      // All should succeed (idempotent)
      results.forEach((r) => expect(r.status).toBe(200));

      // But only 1 record in DB (unique constraint)
      const likeCount = await prisma.knowledgeArticleLike.count({ where: { articleId: artId, userId: empAId } });
      expect(likeCount).toBe(1);
    });

    it('并发收藏同一文章 — 不产生重复记录', async () => {
      const artRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}并发收藏测试`, content: '并发测试', categoryId: testCategoryId });
      const artId = artRes.body.data.id;
      createdArticleIds.push(artId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${artId}/publish`)
        .set('Cookie', empACookies.join('; '));

      // Same user sends 5 concurrent favorites
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).put(`/api/v1/knowledge/articles/${artId}/favorite`).set('Cookie', empACookies.join('; '))
        )
      );

      results.forEach((r) => expect(r.status).toBe(200));

      const favCount = await prisma.knowledgeArticleFavorite.count({ where: { articleId: artId, userId: empAId } });
      expect(favCount).toBe(1);
    });

    it('并发取消点赞 — 不报错', async () => {
      const artRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({ title: `${PREFIX}并发取消点赞`, content: '并发测试', categoryId: testCategoryId });
      const artId = artRes.body.data.id;
      createdArticleIds.push(artId);

      await request(app)
        .post(`/api/v1/knowledge/articles/${artId}/publish`)
        .set('Cookie', empACookies.join('; '));

      // Like first
      await request(app).put(`/api/v1/knowledge/articles/${artId}/like`).set('Cookie', empACookies.join('; '));

      // Concurrent unlike
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(app).delete(`/api/v1/knowledge/articles/${artId}/like`).set('Cookie', empACookies.join('; '))
        )
      );

      results.forEach((r) => expect(r.status).toBe(200));

      const likeCount = await prisma.knowledgeArticleLike.count({ where: { articleId: artId, userId: empAId } });
      expect(likeCount).toBe(0);
    });
  });

  // ==========================================================
  // Phase 8: AI Post-Validation Behaviors
  // Verifies that post-generation checks in queryKnowledge
  // properly guard against user-disable, session-expiry, and
  // source-article-withdrawal race conditions.
  // ==========================================================
  describe('AI后置验证行为', () => {
    const AI_POSTVAL_EMP = {
      username: `kc_ai_pv_${RUN_ID}`,
      password: 'AiPostVal123',
      name: `${PREFIX}AI后置验证员工`,
    };

    let aiPostValId: number;
    let aiPostValCookies: string[];

    beforeAll(async () => {
      // Crash-recovery cleanup for prior aborted runs
      await prisma.user.deleteMany({ where: { username: AI_POSTVAL_EMP.username } });

      const hash = await bcrypt.hash(AI_POSTVAL_EMP.password, 10);
      const user = await prisma.user.create({
        data: {
          username: AI_POSTVAL_EMP.username,
          passwordHash: hash,
          name: AI_POSTVAL_EMP.name,
          role: 'EMPLOYEE',
          departmentId: testDeptId,
          mustChangePassword: false,
        },
      });
      aiPostValId = user.id;
      aiPostValCookies = await loginAs(AI_POSTVAL_EMP.username, AI_POSTVAL_EMP.password);
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { username: AI_POSTVAL_EMP.username } });
    });

    // ---- Test 1: Disabled user cannot access AI endpoint ----
    it('用户在登录后被停用，访问AI查询接口 — 401 ACCOUNT_DISABLED', async () => {
      // disabledCookies were captured BEFORE the user was disabled in outer beforeAll.
      // The auth middleware should reject the request because user.status === 'DISABLED'.
      const res = await request(app)
        .post('/api/v1/knowledge/ai/query')
        .set('Cookie', disabledCookies.join('; '))
        .send({ question: '测试停用用户查询' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    // ---- Test 2: tokenVersion mismatch rejects old session ----
    it('tokenVersion变更后旧会话访问AI接口 — 401 AUTH_SESSION_EXPIRED', async () => {
      // aiPostValCookies were captured with the original tokenVersion.
      // Simulate a password change / admin reset by incrementing tokenVersion in DB.
      await prisma.user.update({
        where: { id: aiPostValId },
        data: { tokenVersion: { increment: 1 } },
      });

      const res = await request(app)
        .post('/api/v1/knowledge/ai/query')
        .set('Cookie', aiPostValCookies.join('; '))
        .send({ question: '测试tokenVersion变更' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_EXPIRED');

      // Restore tokenVersion so it doesn't affect potential future use of this user
      await prisma.user.update({
        where: { id: aiPostValId },
        data: { tokenVersion: { decrement: 1 } },
      });
    });

    // ---- Test 3: Article withdrawn during AI generation → post-validation rejects result ----
    it('文章在AI生成过程中被撤回 — 后置验证拒绝返回结果', async () => {
      // Create a PUBLISHED article with unique searchable content
      const artRes = await request(app)
        .post('/api/v1/knowledge/articles')
        .set('Cookie', empACookies.join('; '))
        .send({
          title: `${PREFIX}AI后置验证专用文章`,
          content: '这是一篇用于验证AI后置状态检查的文章',
          categoryId: testCategoryId,
        });
      expect(artRes.status).toBe(201);
      const artId = artRes.body.data.id;
      createdArticleIds.push(artId);

      const pubRes = await request(app)
        .post(`/api/v1/knowledge/articles/${artId}/publish`)
        .set('Cookie', empACookies.join('; '));
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('PUBLISHED');

      // Dynamically import AiService and MockAiProvider (same pattern as existing AI限流 test)
      const { AiService } = await import('../src/modules/knowledge/ai/ai.service');
      const { MockAiProvider } = await import('../src/modules/knowledge/ai/ai-provider');

      // Create a custom provider that WITHDRAWS the source article during answerQuestion.
      // This simulates the race condition: article is PUBLISHED when the search runs,
      // but gets withdrawn before the post-validation check.
      class WithdrawOnAnswerProvider extends MockAiProvider {
        constructor(private targetArticleId: number) {
          super();
        }

        async answerQuestion(
          question: string,
          refs: Array<{ title: string; content: string }>
        ): Promise<string> {
          // Simulate: article gets withdrawn while AI is "generating"
          await prisma.knowledgeArticle.update({
            where: { id: this.targetArticleId },
            data: { status: 'WITHDRAWN' },
          });
          return super.answerQuestion(question, refs);
        }
      }

      const service = new AiService(new WithdrawOnAnswerProvider(artId));

      // queryKnowledge should:
      // 1. Find the article (PUBLISHED) in the search step
      // 2. Call answerQuestion → our custom provider withdraws the article
      // 3. Post-validation finds no valid sources → throws KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED
      await expect(
        service.queryKnowledge(empAId, 'AI后置验证专用文章')
      ).rejects.toThrow('参考文章已不可用');

      // Verify the article was indeed withdrawn by our custom provider
      const dbArticle = await prisma.knowledgeArticle.findUnique({
        where: { id: artId },
        select: { status: true },
      });
      expect(dbArticle?.status).toBe('WITHDRAWN');
    });
  });
});
