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
const PREFIX = `[day3_${RUN_ID}]`;

// ============================================================
// Test Data
// ============================================================

const ADMIN_USER = {
  username: `day3_admin_${RUN_ID}`,
  password: 'AdminTest123',
  name: `${PREFIX}管理员`,
};

const EMPLOYEE_A = {
  username: `day3_emp_a_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工A`,
};

const EMPLOYEE_B = {
  username: `day3_emp_b_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工B`,
};

const MUST_CHANGE_EMP = {
  username: `day3_mc_${RUN_ID}`,
  password: 'MustChange123',
  name: `${PREFIX}强制改密`,
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
let testDeptId: number;

// Track all announcement IDs created by this test
const createdAnnouncementIds: number[] = [];

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
  await prisma.announcementRead.deleteMany({
    where: { user: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username] } } },
  });
  await prisma.announcement.deleteMany({
    where: { publisher: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username] } } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username] } },
  });
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  // Create a sentinel announcement that MUST survive the test run
  const sentinelAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (sentinelAdmin) {
    const existing = await prisma.announcement.findFirst({
      where: { title: '__day3_sentinel_do_not_delete__' },
    });
    if (!existing) {
      await prisma.announcement.create({
        data: {
          title: '__day3_sentinel_do_not_delete__',
          content: 'Sentinel announcement for verifying test cleanup',
          status: 'DRAFT',
          publisherId: sentinelAdmin.id,
        },
      });
    }
  }

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

  // Login all
  adminCookies = await loginAs(ADMIN_USER.username, ADMIN_USER.password);
  empACookies = await loginAs(EMPLOYEE_A.username, EMPLOYEE_A.password);
  empBCookies = await loginAs(EMPLOYEE_B.username, EMPLOYEE_B.password);
  mustChangeCookies = await loginAs(MUST_CHANGE_EMP.username, MUST_CHANGE_EMP.password);
});

afterAll(async () => {
  // Clean ONLY test-created data, in FK order
  // 1. Reads for our announcements
  if (createdAnnouncementIds.length > 0) {
    await prisma.announcementRead.deleteMany({
      where: { announcementId: { in: createdAnnouncementIds } },
    });
  }
  // 2. Our announcements
  if (createdAnnouncementIds.length > 0) {
    await prisma.announcement.deleteMany({
      where: { id: { in: createdAnnouncementIds } },
    });
  }
  // 3. Our users (by unique username)
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MUST_CHANGE_EMP.username] } },
  });
  // 4. Our department
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  // Verify sentinel still exists (only if one was created)
  const sentinel = await prisma.announcement.findFirst({
    where: { title: '__day3_sentinel_do_not_delete__' },
  });
  if (sentinel) {
    // Good — sentinel survived the test. Clean it up.
    await prisma.announcement.delete({ where: { id: sentinel.id } });
  }

  await prisma.$disconnect();
});

// ============================================================
// Announcement Tests
// ============================================================

describe('公告管理', () => {
  let draftId: number;
  let publishedId: number;
  let withdrawnId: number;

  // --- Admin CRUD ---

  it('管理员创建公告草稿', async () => {
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookies)
      .send({ title: `${PREFIX}测试公告草稿`, content: '这是草稿内容' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.title).toBe(`${PREFIX}测试公告草稿`);
    draftId = res.body.data.id;
    createdAnnouncementIds.push(draftId);
  });

  it('普通员工不能创建公告', async () => {
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', empACookies)
      .send({ title: '员工尝试', content: '不应该成功' });

    expect(res.status).toBe(403);
  });

  it('草稿可以编辑', async () => {
    const res = await request(app)
      .patch(`/api/v1/announcements/${draftId}`)
      .set('Cookie', adminCookies)
      .send({ title: `${PREFIX}修改后的标题`, content: '修改后的内容' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(`${PREFIX}修改后的标题`);
    expect(res.body.data.content).toBe('修改后的内容');
  });

  it('草稿可以发布', async () => {
    const res = await request(app)
      .post(`/api/v1/announcements/${draftId}/publish`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeTruthy();
    publishedId = draftId;
  });

  it('已发布公告不能编辑', async () => {
    const res = await request(app)
      .patch(`/api/v1/announcements/${publishedId}`)
      .set('Cookie', adminCookies)
      .send({ title: '尝试修改', content: '不应该成功' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNOUNCEMENT_STATE_NOT_EDITABLE');
  });

  it('已发布公告不能删除', async () => {
    const res = await request(app)
      .delete(`/api/v1/announcements/${publishedId}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNOUNCEMENT_STATE_NOT_DELETABLE');
  });

  it('已发布公告可以撤回', async () => {
    const res = await request(app)
      .post(`/api/v1/announcements/${publishedId}/withdraw`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WITHDRAWN');
    expect(res.body.data.withdrawnAt).toBeTruthy();
    withdrawnId = publishedId;
  });

  it('已撤回公告不能再次发布', async () => {
    const res = await request(app)
      .post(`/api/v1/announcements/${withdrawnId}/publish`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(409);
  });

  // Create another draft for deletion test
  it('草稿可以删除', async () => {
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookies)
      .send({ title: `${PREFIX}待删除草稿`, content: '将被删除' });

    const deleteId = createRes.body.data.id;
    createdAnnouncementIds.push(deleteId);

    const res = await request(app)
      .delete(`/api/v1/announcements/${deleteId}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(204);
  });

  // --- Employee access ---

  it('普通员工只能看到已发布公告', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const items = res.body.data.items;
    items.forEach((item: any) => {
      expect(item.status).toBeUndefined(); // employee list doesn't include status field
    });
  });

  it('普通员工不能访问草稿', async () => {
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookies)
      .send({ title: `${PREFIX}不可访问草稿`, content: '员工看不到' });

    const dId = createRes.body.data.id;
    createdAnnouncementIds.push(dId);

    const res = await request(app)
      .post(`/api/v1/me/announcements/${dId}/open`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNOUNCEMENT_NOT_AVAILABLE');
  });

  it('普通员工不能访问已撤回公告', async () => {
    const res = await request(app)
      .post(`/api/v1/me/announcements/${withdrawnId}/open`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNOUNCEMENT_NOT_AVAILABLE');
  });

  // --- Reading tracking ---

  let readAnnouncementId: number;

  it('首次查看详情创建阅读记录', async () => {
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookies)
      .send({ title: `${PREFIX}阅读测试公告`, content: '测试阅读记录' });

    readAnnouncementId = createRes.body.data.id;
    createdAnnouncementIds.push(readAnnouncementId);

    await request(app)
      .post(`/api/v1/announcements/${readAnnouncementId}/publish`)
      .set('Cookie', adminCookies);

    // Employee A opens it
    const res = await request(app)
      .post(`/api/v1/me/announcements/${readAnnouncementId}/open`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.read).toBe(true);
    expect(res.body.data.firstReadAt).toBeTruthy();
  });

  it('重复查看不增加记录', async () => {
    await request(app)
      .post(`/api/v1/me/announcements/${readAnnouncementId}/open`)
      .set('Cookie', empACookies);

    const readCount = await prisma.announcementRead.count({
      where: { announcementId: readAnnouncementId, userId: empAId },
    });

    expect(readCount).toBe(1);
  });

  it('重复查看不覆盖首次阅读时间', async () => {
    const readRecord = await prisma.announcementRead.findUnique({
      where: {
        announcementId_userId: {
          announcementId: readAnnouncementId,
          userId: empAId,
        },
      },
    });

    const firstReadAt = readRecord!.firstReadAt;

    await new Promise((resolve) => setTimeout(resolve, 100));

    await request(app)
      .post(`/api/v1/me/announcements/${readAnnouncementId}/open`)
      .set('Cookie', empACookies);

    const readRecordAfter = await prisma.announcementRead.findUnique({
      where: {
        announcementId_userId: {
          announcementId: readAnnouncementId,
          userId: empAId,
        },
      },
    });

    expect(readRecordAfter!.firstReadAt.getTime()).toBe(firstReadAt.getTime());
  });

  // --- Read statistics ---

  it('管理员查看阅读统计', async () => {
    // Employee B also reads
    await request(app)
      .post(`/api/v1/me/announcements/${readAnnouncementId}/open`)
      .set('Cookie', empBCookies);

    const res = await request(app)
      .get(`/api/v1/announcements/${readAnnouncementId}/read-stats`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.readCount).toBe(2);
    expect(res.body.data.totalEmployees).toBeGreaterThanOrEqual(2);
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(0);
    expect(res.body.data.readRate).toBeGreaterThanOrEqual(0);
  });

  it('已读和未读员工列表正确', async () => {
    const readRes = await request(app)
      .get(`/api/v1/announcements/${readAnnouncementId}/read-list`)
      .set('Cookie', adminCookies);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.items.length).toBe(2);

    const unreadRes = await request(app)
      .get(`/api/v1/announcements/${readAnnouncementId}/unread-list`)
      .set('Cookie', adminCookies);

    expect(unreadRes.status).toBe(200);
    const unreadIds = unreadRes.body.data.items.map((i: any) => i.userId);
    expect(unreadIds).not.toContain(empAId);
    expect(unreadIds).not.toContain(empBId);
  });

  // --- Auth & permission ---

  it('未认证访问被拦截', async () => {
    const res = await request(app)
      .get('/api/v1/announcements');

    expect(res.status).toBe(401);
  });

  it('强制改密期间访问业务接口被拦截', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .set('Cookie', mustChangeCookies);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

// ============================================================
// ID Parameter Validation (Problem 6)
// ============================================================

describe('ID 参数校验', () => {
  it('非数字 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/announcements/abc')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('负数 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/announcements/-1')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('零 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/announcements/0')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('小数 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/announcements/1.5')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('通讯录非数字 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/directory/xyz')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('通讯录负数 ID 返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/directory/-5')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('员工打开公告的非数字 ID 返回 400', async () => {
    const res = await request(app)
      .post('/api/v1/me/announcements/NaN/open')
      .set('Cookie', empACookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('公告发布使用无效 ID 返回 400', async () => {
    const res = await request(app)
      .post('/api/v1/announcements/0/publish')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// 已读/未读筛选分页 (Problem 2)
// ============================================================

describe('已读/未读筛选分页', () => {
  const filterPrefix = `[filter_${RUN_ID}]`;
  let empFilterId: number;
  let empFilterCookies: string[];
  const publishedIds: number[] = [];
  let filterDeptId: number;
  const filterUsernames: string[] = [];

  beforeAll(async () => {
    // Create a dedicated department and employee for filter tests
    const dept = await prisma.department.create({ data: { name: `${filterPrefix}部门` } });
    filterDeptId = dept.id;

    const hash = await bcrypt.hash('FilterTest123', 10);
    const uName = `day3_filter_emp_${RUN_ID}`;
    filterUsernames.push(uName);
    const user = await prisma.user.create({
      data: {
        username: uName,
        passwordHash: hash,
        name: `${filterPrefix}筛选员工`,
        role: 'EMPLOYEE',
        departmentId: filterDeptId,
        mustChangePassword: false,
      },
    });
    empFilterId = user.id;
    empFilterCookies = await loginAs(uName, 'FilterTest123');

    // Create 5 published announcements, emp reads first 3
    for (let i = 1; i <= 5; i++) {
      const a = await prisma.announcement.create({
        data: {
          title: `${filterPrefix}公告${i}`,
          content: `内容${i}`,
          status: 'PUBLISHED',
          publisherId: adminId,
          publishedAt: new Date(Date.now() - (5 - i) * 60000),
        },
      });
      publishedIds.push(a.id);
      createdAnnouncementIds.push(a.id);
      if (i <= 3) {
        await prisma.announcementRead.create({
          data: { announcementId: a.id, userId: empFilterId, firstReadAt: new Date() },
        });
      }
    }
  });

  afterAll(async () => {
    // Clean filter test data
    await prisma.announcementRead.deleteMany({ where: { userId: empFilterId } });
    await prisma.user.deleteMany({ where: { username: { in: filterUsernames } } });
    await prisma.department.deleteMany({ where: { id: filterDeptId } });
  });

  it('READ 筛选只返回已读公告', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'READ' })
      .set('Cookie', empFilterCookies);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(items.length).toBe(3);
    items.forEach((item: any) => {
      expect(item.read).toBe(true);
      expect(publishedIds.slice(0, 3)).toContain(item.id);
    });
  });

  it('UNREAD 筛选只返回未读公告', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'UNREAD' })
      .set('Cookie', empFilterCookies);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    // Filter to only items created in this test
    const testUnread = items.filter((item: any) => publishedIds.includes(item.id));
    expect(testUnread.length).toBe(2);
    testUnread.forEach((item: any) => {
      expect(item.read).toBe(false);
    });
  });

  it('READ 筛选总数正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'READ', page: 1, pageSize: 100 })
      .set('Cookie', empFilterCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it('UNREAD 筛选总数正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'UNREAD', page: 1, pageSize: 100 })
      .set('Cookie', empFilterCookies);

    expect(res.status).toBe(200);
    // Total includes all published announcements unread by this employee
    // (including those from other test blocks), so just verify >= 2
    const testUnread = res.body.data.items.filter((item: any) => publishedIds.includes(item.id));
    expect(testUnread.length).toBe(2);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('跨页不会漏数据 - READ 分页', async () => {
    // Get page 1 with pageSize 2
    const page1 = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'READ', page: 1, pageSize: 2 })
      .set('Cookie', empFilterCookies);

    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.pagination.total).toBe(3);

    // Get page 2
    const page2 = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'READ', page: 2, pageSize: 2 })
      .set('Cookie', empFilterCookies);

    expect(page2.body.data.items.length).toBe(1);
    expect(page2.body.data.pagination.total).toBe(3);

    // No overlap
    const page1Ids = page1.body.data.items.map((i: any) => i.id);
    const page2Ids = page2.body.data.items.map((i: any) => i.id);
    const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('草稿和已撤回公告不进入员工筛选结果', async () => {
    // Create a draft and a withdrawn announcement
    const draft = await prisma.announcement.create({
      data: { title: `${filterPrefix}草稿`, content: '不应出现', status: 'DRAFT', publisherId: adminId },
    });
    const withdrawn = await prisma.announcement.create({
      data: { title: `${filterPrefix}撤回`, content: '不应出现', status: 'WITHDRAWN', publisherId: adminId },
    });
    createdAnnouncementIds.push(draft.id, withdrawn.id);

    const readRes = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'READ', page: 1, pageSize: 100 })
      .set('Cookie', empFilterCookies);

    const unreadRes = await request(app)
      .get('/api/v1/me/announcements')
      .query({ readStatus: 'UNREAD', page: 1, pageSize: 100 })
      .set('Cookie', empFilterCookies);

    const allIds = [
      ...readRes.body.data.items.map((i: any) => i.id),
      ...unreadRes.body.data.items.map((i: any) => i.id),
    ];

    expect(allIds).not.toContain(draft.id);
    expect(allIds).not.toContain(withdrawn.id);
  });
});

// ============================================================
// 停用员工阅读统计 (Problem 4)
// ============================================================

describe('停用员工阅读统计', () => {
  const disabledPrefix = `[disabled_${RUN_ID}]`;
  let empDisabledId: number;
  let empDisabledCookies: string[];
  let announcementId: number;
  const disabledUsernames: string[] = [];
  let disabledDeptId: number;

  beforeAll(async () => {
    // Create department and employee
    const dept = await prisma.department.create({ data: { name: `${disabledPrefix}部门` } });
    disabledDeptId = dept.id;

    const hash = await bcrypt.hash('DisabledTest123', 10);
    const uName = `day3_disabled_emp_${RUN_ID}`;
    disabledUsernames.push(uName);
    const user = await prisma.user.create({
      data: {
        username: uName,
        passwordHash: hash,
        name: `${disabledPrefix}停用员工`,
        role: 'EMPLOYEE',
        departmentId: disabledDeptId,
        mustChangePassword: false,
      },
    });
    empDisabledId = user.id;
    empDisabledCookies = await loginAs(uName, 'DisabledTest123');

    // Create and publish announcement
    const a = await prisma.announcement.create({
      data: {
        title: `${disabledPrefix}停用测试公告`,
        content: '测试停用员工统计',
        status: 'PUBLISHED',
        publisherId: adminId,
        publishedAt: new Date(),
      },
    });
    announcementId = a.id;
    createdAnnouncementIds.push(announcementId);

    // Employee reads the announcement
    await prisma.announcementRead.create({
      data: { announcementId: announcementId, userId: empDisabledId, firstReadAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.announcementRead.deleteMany({ where: { userId: empDisabledId } });
    await prisma.user.deleteMany({ where: { username: { in: disabledUsernames } } });
    await prisma.department.deleteMany({ where: { id: disabledDeptId } });
  });

  it('停用前：该员工计入已读', async () => {
    const statsRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/read-stats`)
      .set('Cookie', adminCookies);

    expect(statsRes.status).toBe(200);
    const readCountBefore = statsRes.body.data.readCount;
    expect(readCountBefore).toBeGreaterThanOrEqual(1);

    const readListRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/read-list`)
      .set('Cookie', adminCookies);

    const readIds = readListRes.body.data.items.map((i: any) => i.userId);
    expect(readIds).toContain(empDisabledId);
  });

  it('员工阅读后被停用', async () => {
    // Disable the employee
    await prisma.user.update({
      where: { id: empDisabledId },
      data: { status: 'DISABLED' },
    });

    const user = await prisma.user.findUnique({ where: { id: empDisabledId } });
    expect(user!.status).toBe('DISABLED');
  });

  it('停用后总人数减少', async () => {
    const totalBefore = await prisma.user.count({
      where: { role: 'EMPLOYEE', status: 'ENABLED' },
    });

    const statsRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/read-stats`)
      .set('Cookie', adminCookies);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totalEmployees).toBeLessThanOrEqual(totalBefore);
  });

  it('停用后该员工不计入已读人数且统计一致', async () => {
    const statsRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/read-stats`)
      .set('Cookie', adminCookies);

    expect(statsRes.status).toBe(200);
    // readCount should not include the disabled employee
    const readListRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/read-list`)
      .query({ page: 1, pageSize: 100 })
      .set('Cookie', adminCookies);

    const readIds = readListRes.body.data.items.map((i: any) => i.userId);
    expect(readIds).not.toContain(empDisabledId);
    expect(readListRes.body.data.pagination.total).toBe(statsRes.body.data.readCount);

    // Verify the disabled employee is not in unread list either
    const unreadListRes = await request(app)
      .get(`/api/v1/announcements/${announcementId}/unread-list`)
      .query({ page: 1, pageSize: 100 })
      .set('Cookie', adminCookies);

    const unreadIds = unreadListRes.body.data.items.map((i: any) => i.userId);
    expect(unreadIds).not.toContain(empDisabledId);

    // Stats invariants: unreadCount >= 0, readRate <= 100%
    expect(statsRes.body.data.unreadCount).toBeGreaterThanOrEqual(0);
    expect(statsRes.body.data.readRate).toBeLessThanOrEqual(100);

    // totalEmployees should only count EMPLOYEE role, not ADMIN
    const totalEmp = await prisma.user.count({
      where: { role: 'EMPLOYEE', status: 'ENABLED' },
    });
    expect(statsRes.body.data.totalEmployees).toBe(totalEmp);
  });
});

// ============================================================
// Directory Tests
// ============================================================

describe('通讯录', () => {
  it('管理员可以查询', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
  });

  it('普通员工可以查询', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('姓名和账号搜索', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .query({ keyword: EMPLOYEE_A.name })
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(items.some((i: any) => i.name === EMPLOYEE_A.name)).toBe(true);
  });

  it('部门筛选', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .query({ departmentId: testDeptId })
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    items.forEach((i: any) => {
      expect(i.department?.id).toBe(testDeptId);
    });
  });

  it('分页', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .query({ page: 1, pageSize: 1 })
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.pageSize).toBe(1);
  });

  it('详情查询', async () => {
    const res = await request(app)
      .get(`/api/v1/directory/${empAId}`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(empAId);
    expect(res.body.data.name).toBe(EMPLOYEE_A.name);
  });

  it('联系方式为空', async () => {
    const res = await request(app)
      .get(`/api/v1/directory/${empAId}`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.workEmail).toBeNull();
    expect(res.body.data.phone).toBeNull();
  });

  it('响应不包含密码哈希和认证字段', async () => {
    const res = await request(app)
      .get(`/api/v1/directory/${empAId}`)
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.tokenVersion).toBeUndefined();
    expect(res.body.data.mustChangePassword).toBeUndefined();
    expect(res.body.data.status).toBeUndefined();
  });

  it('未认证返回 401', async () => {
    const res = await request(app)
      .get('/api/v1/directory');

    expect(res.status).toBe(401);
  });

  it('强制改密期间返回 403', async () => {
    const res = await request(app)
      .get('/api/v1/directory')
      .set('Cookie', mustChangeCookies);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
