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
const PREFIX = `[day5_${RUN_ID}]`;

// ============================================================
// Test Data
// ============================================================

const ADMIN_USER = {
  username: `day5_admin_${RUN_ID}`,
  password: 'AdminTest123',
  name: `${PREFIX}管理员`,
};

const EMPLOYEE_A = {
  username: `day5_emp_a_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工A`,
  workEmail: `empa_${RUN_ID}@test.com`,
  phone: '13800000001',
};

const EMPLOYEE_B = {
  username: `day5_emp_b_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工B`,
};

const MANAGER_EMP = {
  username: `day5_mgr_${RUN_ID}`,
  password: 'MgrTest123',
  name: `${PREFIX}负责人`,
  workEmail: `mgr_${RUN_ID}@test.com`,
  phone: '13800000002',
};

const MUST_CHANGE_EMP = {
  username: `day5_mc_${RUN_ID}`,
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
let managerId: number;
let managerCookies: string[];
let mustChangeId: number;
let mustChangeCookies: string[];
let testDeptId: number;

// Track created IDs for precise cleanup
const createdAnnouncementIds: number[] = [];
const createdLeaveIds: number[] = [];

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
    where: { user: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MANAGER_EMP.username, MUST_CHANGE_EMP.username] } } },
  });
  await prisma.leaveActionLog.deleteMany({
    where: { leaveRequest: { applicant: { username: { in: [EMPLOYEE_A.username, EMPLOYEE_B.username, MANAGER_EMP.username, MUST_CHANGE_EMP.username] } } } },
  });
  await prisma.leaveRequest.deleteMany({
    where: { applicant: { username: { in: [EMPLOYEE_A.username, EMPLOYEE_B.username, MANAGER_EMP.username, MUST_CHANGE_EMP.username] } } },
  });
  await prisma.announcement.deleteMany({
    where: { publisher: { username: { in: [ADMIN_USER.username] } } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MANAGER_EMP.username, MUST_CHANGE_EMP.username] } },
  });
  await prisma.department.deleteMany({ where: { name: TEST_DEPT_NAME } });

  // Create department
  const dept = await prisma.department.create({
    data: { name: TEST_DEPT_NAME },
  });
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

  // Create employee A
  const empAHash = await bcrypt.hash(EMPLOYEE_A.password, 10);
  const empA = await prisma.user.create({
    data: {
      username: EMPLOYEE_A.username,
      passwordHash: empAHash,
      name: EMPLOYEE_A.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      jobTitle: '前端工程师',
      workEmail: EMPLOYEE_A.workEmail,
      phone: EMPLOYEE_A.phone,
      mustChangePassword: false,
    },
  });
  empAId = empA.id;

  // Create employee B
  const empBHash = await bcrypt.hash(EMPLOYEE_B.password, 10);
  const empB = await prisma.user.create({
    data: {
      username: EMPLOYEE_B.username,
      passwordHash: empBHash,
      name: EMPLOYEE_B.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      jobTitle: '后端工程师',
      mustChangePassword: false,
    },
  });
  empBId = empB.id;

  // Create manager employee (set as department manager)
  const mgrHash = await bcrypt.hash(MANAGER_EMP.password, 10);
  const mgr = await prisma.user.create({
    data: {
      username: MANAGER_EMP.username,
      passwordHash: mgrHash,
      name: MANAGER_EMP.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      jobTitle: '技术主管',
      workEmail: MANAGER_EMP.workEmail,
      phone: MANAGER_EMP.phone,
      mustChangePassword: false,
    },
  });
  managerId = mgr.id;

  // Set as department manager
  await prisma.department.update({
    where: { id: testDeptId },
    data: { managerUserId: managerId },
  });

  // Create must-change-password employee
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

  // Login all users
  [adminCookies, empACookies, empBCookies, managerCookies, mustChangeCookies] = await Promise.all([
    loginAs(ADMIN_USER.username, ADMIN_USER.password),
    loginAs(EMPLOYEE_A.username, EMPLOYEE_A.password),
    loginAs(EMPLOYEE_B.username, EMPLOYEE_B.password),
    loginAs(MANAGER_EMP.username, MANAGER_EMP.password),
    loginAs(MUST_CHANGE_EMP.username, MUST_CHANGE_EMP.password),
  ]);

  // Create test announcements
  const ann1 = await prisma.announcement.create({
    data: {
      title: `${PREFIX}公告1-已发布未读`,
      content: '公告内容1',
      status: 'PUBLISHED',
      publisherId: adminId,
      publishedAt: new Date('2026-09-01T10:00:00Z'),
    },
  });
  createdAnnouncementIds.push(ann1.id);

  const ann2 = await prisma.announcement.create({
    data: {
      title: `${PREFIX}公告2-已发布已读`,
      content: '公告内容2',
      status: 'PUBLISHED',
      publisherId: adminId,
      publishedAt: new Date('2026-09-02T10:00:00Z'),
    },
  });
  createdAnnouncementIds.push(ann2.id);

  // Mark ann2 as read by empA
  await prisma.announcementRead.create({
    data: { announcementId: ann2.id, userId: empAId },
  });

  const ann3 = await prisma.announcement.create({
    data: {
      title: `${PREFIX}公告3-已撤回`,
      content: '公告内容3',
      status: 'WITHDRAWN',
      publisherId: adminId,
      publishedAt: new Date('2026-09-03T10:00:00Z'),
      withdrawnAt: new Date('2026-09-03T12:00:00Z'),
    },
  });
  createdAnnouncementIds.push(ann3.id);

  const ann4 = await prisma.announcement.create({
    data: {
      title: `${PREFIX}公告4-草稿`,
      content: '公告内容4',
      status: 'DRAFT',
      publisherId: adminId,
    },
  });
  createdAnnouncementIds.push(ann4.id);

  // Create test leave requests
  // empA: 1 PENDING, 1 APPROVED
  const leave1 = await prisma.leaveRequest.create({
    data: {
      applicantId: empAId,
      applicantNameSnapshot: EMPLOYEE_A.name,
      submittedDepartmentId: testDeptId,
      departmentNameSnapshot: TEST_DEPT_NAME,
      approverId: managerId,
      approverNameSnapshot: MANAGER_EMP.name,
      leaveType: 'PERSONAL',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-03'),
      days: 3,
      reason: '个人事务',
      status: 'PENDING',
      stateVersion: 0,
    },
  });
  createdLeaveIds.push(leave1.id);

  const leave2 = await prisma.leaveRequest.create({
    data: {
      applicantId: empAId,
      applicantNameSnapshot: EMPLOYEE_A.name,
      submittedDepartmentId: testDeptId,
      departmentNameSnapshot: TEST_DEPT_NAME,
      approverId: managerId,
      approverNameSnapshot: MANAGER_EMP.name,
      leaveType: 'ANNUAL',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-05'),
      days: 5,
      reason: '年假',
      status: 'APPROVED',
      stateVersion: 1,
    },
  });
  createdLeaveIds.push(leave2.id);

  // empB: 1 REJECTED
  const leave3 = await prisma.leaveRequest.create({
    data: {
      applicantId: empBId,
      applicantNameSnapshot: EMPLOYEE_B.name,
      submittedDepartmentId: testDeptId,
      departmentNameSnapshot: TEST_DEPT_NAME,
      approverId: managerId,
      approverNameSnapshot: MANAGER_EMP.name,
      leaveType: 'SICK',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-10'),
      days: 1,
      reason: '看病',
      status: 'REJECTED',
      stateVersion: 1,
    },
  });
  createdLeaveIds.push(leave3.id);
});

// ============================================================
// Cleanup
// ============================================================

afterAll(async () => {
  // FK-order cleanup: children first
  if (createdLeaveIds.length > 0) {
    await prisma.leaveActionLog.deleteMany({
      where: { leaveRequestId: { in: createdLeaveIds } },
    });
    await prisma.leaveRequest.deleteMany({
      where: { id: { in: createdLeaveIds } },
    });
  }
  if (createdAnnouncementIds.length > 0) {
    await prisma.announcementRead.deleteMany({
      where: { announcementId: { in: createdAnnouncementIds } },
    });
    await prisma.announcement.deleteMany({
      where: { id: { in: createdAnnouncementIds } },
    });
  }
  // Remove manager relationship before deleting users
  await prisma.department.updateMany({
    where: { id: testDeptId },
    data: { managerUserId: null },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_A.username, EMPLOYEE_B.username, MANAGER_EMP.username, MUST_CHANGE_EMP.username] } },
  });
  await prisma.department.deleteMany({ where: { id: testDeptId } });

  await prisma.$disconnect();
});

// ============================================================
// Helper: filter dashboard results to only our test data
// ============================================================

function filterTestAnnouncements(anns: any[]) {
  return anns.filter((a: any) => createdAnnouncementIds.includes(a.id));
}

function filterTestLeaves(leaves: any[]) {
  return leaves.filter((l: any) => createdLeaveIds.includes(l.id));
}

function filterTestApprovals(approvals: any[]) {
  return approvals.filter((a: any) => createdLeaveIds.includes(a.id));
}

// ============================================================
// Profile Tests (GET /me + PATCH /me/contact)
// ============================================================

describe('个人资料 API', () => {
  it('1. 获取当前用户资料', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(EMPLOYEE_A.username);
    expect(res.body.data.name).toBe(EMPLOYEE_A.name);
    expect(res.body.data.role).toBe('EMPLOYEE');
    expect(res.body.data.department.name).toBe(TEST_DEPT_NAME);
    expect(res.body.data.jobTitle).toBe('前端工程师');
  });

  it('2. 修改工作邮箱', async () => {
    const newEmail = `updated_${RUN_ID}@test.com`;
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: newEmail, phone: EMPLOYEE_A.phone });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workEmail).toBe(newEmail);
  });

  it('3. 修改联系电话', async () => {
    const newPhone = '13900000001';
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: `updated_${RUN_ID}@test.com`, phone: newPhone });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe(newPhone);
  });

  it('4. 邮箱和电话可以清空', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: null, phone: null });

    expect(res.status).toBe(200);
    expect(res.body.data.workEmail).toBeNull();
    expect(res.body.data.phone).toBeNull();

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });

  it('5. 空字符串标准化为 null', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: '', phone: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.workEmail).toBeNull();
    expect(res.body.data.phone).toBeNull();

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });

  it('6. 非法邮箱返回 400', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'not-an-email', phone: '13800000001' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('7. 超长电话返回 400', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '1'.repeat(31) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8. 不允许修改姓名', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001', name: '黑客' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('9. 不允许修改账号', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001', username: 'hacker' });

    expect(res.status).toBe(400);
  });

  it('10. 不允许修改角色', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001', role: 'ADMIN' });

    expect(res.status).toBe(400);
  });

  it('11. 不允许修改部门', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001', departmentId: 999 });

    expect(res.status).toBe(400);
  });

  it('12. 不允许修改职务', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001', jobTitle: '总经理' });

    expect(res.status).toBe(400);
  });

  it('13. 响应不包含密码和认证内部字段', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.tokenVersion).toBeUndefined();
    expect(res.body.data.token).toBeUndefined();
  });

  it('14. 修改后重新获取 /me 返回最新值', async () => {
    const newEmail = `latest_${RUN_ID}@test.com`;
    const newPhone = '13999999999';

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: newEmail, phone: newPhone });

    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', empACookies);

    expect(res.body.data.workEmail).toBe(newEmail);
    expect(res.body.data.phone).toBe(newPhone);

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });

  it('15. 通讯录立即展示最新联系方式', async () => {
    const dirEmail = `dir_${RUN_ID}@test.com`;
    const dirPhone = '13777777777';

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: dirEmail, phone: dirPhone });

    const res = await request(app)
      .get('/api/v1/directory')
      .set('Cookie', empBCookies)
      .query({ keyword: EMPLOYEE_A.name });

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    const found = items.find((i: any) => i.name === EMPLOYEE_A.name);
    expect(found).toBeDefined();
    expect(found.workEmail).toBe(dirEmail);
    expect(found.phone).toBe(dirPhone);

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });

  it('16. 不能修改其他用户资料', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: 'safe@test.com', phone: '13800000001' });

    expect(res.status).toBe(200);
    const otherUser = await request(app)
      .get('/api/v1/me')
      .set('Cookie', empBCookies);
    expect(otherUser.body.data.workEmail).not.toBe('safe@test.com');

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });

  it('17. 未认证返回 401', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .send({ workEmail: 'test@test.com', phone: '13800000001' });

    expect(res.status).toBe(401);
  });

  it('18. 强制改密期间不能修改联系方式', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', mustChangeCookies)
      .send({ workEmail: 'test@test.com', phone: '13800000001' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('19. 邮箱和电话首尾空格被清理', async () => {
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: '  trimmed@test.com  ', phone: '  13800000001  ' });

    expect(res.status).toBe(200);
    expect(res.body.data.workEmail).toBe('trimmed@test.com');
    expect(res.body.data.phone).toBe('13800000001');

    await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', empACookies)
      .send({ workEmail: EMPLOYEE_A.workEmail, phone: EMPLOYEE_A.phone });
  });
});

// ============================================================
// Dashboard Tests (GET /me/work-overview)
// ============================================================

describe('工作概览 API', () => {
  it('20. 未读公告数量正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // After serial cleanup of prior tests, only our 2 PUBLISHED announcements exist
    // empA read ann2, so only ann1 is unread
    expect(res.body.data.unreadAnnouncementCount).toBe(1);

    const testAnns = filterTestAnnouncements(res.body.data.recentAnnouncements);
    const ann1 = testAnns.find((a: any) => a.id === createdAnnouncementIds[0]);
    const ann2 = testAnns.find((a: any) => a.id === createdAnnouncementIds[1]);
    expect(ann1).toBeDefined();
    expect(ann1.read).toBe(false);
    expect(ann2).toBeDefined();
    expect(ann2.read).toBe(true);
  });

  it('21. 已读公告不计入未读数量', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    const testAnns = filterTestAnnouncements(res.body.data.recentAnnouncements);
    const ann2 = testAnns.find((a: any) => a.id === createdAnnouncementIds[1]);
    expect(ann2).toBeDefined();
    expect(ann2.read).toBe(true);
    expect(ann2.firstReadAt).toBeDefined();
  });

  it('22. 撤回公告不计入未读数量', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    const testAnns = filterTestAnnouncements(res.body.data.recentAnnouncements);
    const ann3 = testAnns.find((a: any) => a.id === createdAnnouncementIds[2]);
    expect(ann3).toBeUndefined();
  });

  it('23. 最近公告排序正确且数量受限', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    const anns = res.body.data.recentAnnouncements;
    expect(Array.isArray(anns)).toBe(true);
    expect(anns.length).toBeLessThanOrEqual(5);
    const testAnns = filterTestAnnouncements(anns);
    expect(testAnns.length).toBe(2);
    const ann2InResult = testAnns.find((a: any) => a.title.includes('公告2'));
    const ann1InResult = testAnns.find((a: any) => a.title.includes('公告1'));
    expect(ann2InResult).toBeDefined();
    expect(ann1InResult).toBeDefined();
    expect(ann2InResult.read).toBe(true);
    expect(ann1InResult.read).toBe(false);
  });

  it('24. 我的请假状态统计正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    const stats = res.body.data.myLeaveStats;
    expect(stats).toBeDefined();
    expect(stats.pending).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(0);
    expect(stats.cancelled).toBe(0);
  });

  it('25. 不混入其他员工请假', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    // empA's stats should only reflect empA's leaves
    const stats = res.body.data.myLeaveStats;
    expect(stats.pending).toBe(1);  // leave1 (PENDING)
    expect(stats.approved).toBe(1); // leave2 (APPROVED)
    expect(stats.rejected).toBe(0); // leave3 belongs to empB, not empA

    // Recent leaves should only contain empA's leaves
    const testLeaves = filterTestLeaves(res.body.data.recentLeaves);
    for (const leave of testLeaves) {
      expect([createdLeaveIds[0], createdLeaveIds[1]]).toContain(leave.id);
    }
    const empBLeave = testLeaves.find((l: any) => l.id === createdLeaveIds[2]);
    expect(empBLeave).toBeUndefined();
  });

  it('26. 最近请假排序和数量正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    const leaves = res.body.data.recentLeaves;
    expect(Array.isArray(leaves)).toBe(true);
    expect(leaves.length).toBeLessThanOrEqual(5);
    const testLeaves = filterTestLeaves(leaves);
    expect(testLeaves.length).toBe(2);
  });

  it('27. 普通员工不返回负责人待办字段', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    expect(res.body.data.pendingApprovalCount).toBeUndefined();
    expect(res.body.data.recentPendingApprovals).toBeUndefined();
  });

  it('28. 部门负责人待审批数量正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', managerCookies);

    // manager has 1 pending approval from our test data (leave1)
    expect(res.body.data.pendingApprovalCount).toBe(1);
    expect(res.body.data.user.isDepartmentManager).toBe(true);
  });

  it('29. 部门负责人最近待办正确', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', managerCookies);

    const approvals = res.body.data.recentPendingApprovals;
    expect(Array.isArray(approvals)).toBe(true);
    expect(approvals.length).toBeLessThanOrEqual(5);
    const testApprovals = filterTestApprovals(approvals);
    const found = testApprovals.find((a: any) =>
      a.id === createdLeaveIds[0] && a.applicantName === EMPLOYEE_A.name
    );
    expect(found).toBeDefined();
  });

  it('30. 负责人看不到其他部门或其他审批人的待办', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', managerCookies);

    const approvals = res.body.data.recentPendingApprovals;
    const testApprovals = filterTestApprovals(approvals);
    for (const a of testApprovals) {
      expect(a.applicantName).toBeDefined();
    }
  });

  it('31. 空数据返回空数组和 0', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empBCookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.recentAnnouncements)).toBe(true);
    expect(Array.isArray(res.body.data.recentLeaves)).toBe(true);
    expect(typeof res.body.data.unreadAnnouncementCount).toBe('number');
    expect(typeof res.body.data.myLeaveStats.pending).toBe('number');
    expect(typeof res.body.data.myLeaveStats.approved).toBe('number');
    expect(typeof res.body.data.myLeaveStats.rejected).toBe('number');
    expect(typeof res.body.data.myLeaveStats.cancelled).toBe('number');
  });

  it('32. 未认证返回 401', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview');

    expect(res.status).toBe(401);
  });

  it('33. 强制改密期间返回 403', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', mustChangeCookies);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('34. 响应不包含敏感字段', async () => {
    const res = await request(app)
      .get('/api/v1/me/work-overview')
      .set('Cookie', empACookies);

    expect(res.status).toBe(200);
    const data = JSON.stringify(res.body.data);
    expect(data).not.toContain('passwordHash');
    expect(data).not.toContain('tokenVersion');
    expect(data).not.toContain('password');
  });
});
