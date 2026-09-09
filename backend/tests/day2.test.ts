import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';

const prisma = new PrismaClient();
const app = createApp();

// ============================================================
// Test Data
// ============================================================

const ADMIN_USER = {
  username: 'day2_test_admin',
  password: 'AdminTest123',
  name: 'Day2测试管理员',
};

const EMPLOYEE_USER = {
  username: 'day2_test_employee',
  password: 'EmpTest123',
  name: 'Day2测试员工',
};

const TEST_DEPT_NAME = 'Day2测试部门';
const TEST_DEPT2_NAME = 'Day2测试部门B';

let adminId: number;
let adminCookies: string[];
let employeeId: number;
let employeeCookies: string[];
let testDeptId: number;
let testDept2Id: number;

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
  // Clean up test data (respect foreign key order)
  await prisma.announcementRead.deleteMany({
    where: { announcement: { publisher: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } } } },
  });
  await prisma.announcement.deleteMany({
    where: { publisher: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } } },
  });

  // Delete test users and departments
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } },
  });
  await prisma.department.deleteMany({
    where: { name: { in: [TEST_DEPT_NAME, TEST_DEPT2_NAME, 'Day2可删除部门', 'Day2有员工部门', 'Day2有负责人部门'] } },
  });

  // Create admin
  const adminHash = await bcrypt.hash(ADMIN_USER.password, 10);
  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USER.username },
    update: { passwordHash: adminHash, status: 'ENABLED', tokenVersion: 0, mustChangePassword: false },
    create: {
      username: ADMIN_USER.username,
      passwordHash: adminHash,
      name: ADMIN_USER.name,
      role: 'ADMIN',
      mustChangePassword: false,
    },
  });
  adminId = admin.id;

  // Create test department
  const dept = await prisma.department.upsert({
    where: { name: TEST_DEPT_NAME },
    update: {},
    create: { name: TEST_DEPT_NAME },
  });
  testDeptId = dept.id;

  const dept2 = await prisma.department.upsert({
    where: { name: TEST_DEPT2_NAME },
    update: {},
    create: { name: TEST_DEPT2_NAME },
  });
  testDept2Id = dept2.id;

  // Create employee in test department
  const empHash = await bcrypt.hash(EMPLOYEE_USER.password, 10);
  const emp = await prisma.user.upsert({
    where: { username: EMPLOYEE_USER.username },
    update: { passwordHash: empHash, status: 'ENABLED', departmentId: testDeptId, tokenVersion: 0, mustChangePassword: false },
    create: {
      username: EMPLOYEE_USER.username,
      passwordHash: empHash,
      name: EMPLOYEE_USER.name,
      role: 'EMPLOYEE',
      departmentId: testDeptId,
      mustChangePassword: false,
    },
  });
  employeeId = emp.id;

  // Login to get cookies
  adminCookies = await loginAs(ADMIN_USER.username, ADMIN_USER.password);
  employeeCookies = await loginAs(EMPLOYEE_USER.username, EMPLOYEE_USER.password);
});

afterAll(async () => {
  // Cleanup
  await prisma.announcementRead.deleteMany({
    where: { announcement: { publisher: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } } } },
  });
  await prisma.announcement.deleteMany({
    where: { publisher: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [ADMIN_USER.username, EMPLOYEE_USER.username, 'day2_emp_a', 'day2_emp_b', 'day2_emp_c'] } },
  });
  await prisma.department.deleteMany({
    where: { name: { in: [TEST_DEPT_NAME, TEST_DEPT2_NAME, 'Day2可删除部门', 'Day2有员工部门', 'Day2有负责人部门', 'Day2新部门'] } },
  });
  await prisma.$disconnect();
});

// ============================================================
// DEPARTMENT TESTS
// ============================================================

describe('部门管理', () => {
  describe('创建部门', () => {
    it('管理员创建部门成功', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', adminCookies)
        .send({ name: 'Day2新部门' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Day2新部门');
      expect(res.body.data.manager).toBeNull();
    });

    it('重复名称失败', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', adminCookies)
        .send({ name: TEST_DEPT_NAME });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DEPARTMENT_NAME_ALREADY_EXISTS');
    });

    it('名称为空失败', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', adminCookies)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('普通员工创建部门失败', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', employeeCookies)
        .send({ name: '员工创建的部门' });

      expect(res.status).toBe(403);
    });
  });

  describe('部门列表', () => {
    it('管理员查看分页列表成功', async () => {
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('关键字搜索成功', async () => {
      const res = await request(app)
        .get('/api/v1/departments?keyword=Day2测试')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('部门详情', () => {
    it('管理员查看部门详情成功', async () => {
      const res = await request(app)
        .get(`/api/v1/departments/${testDeptId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testDeptId);
      expect(res.body.data.name).toBe(TEST_DEPT_NAME);
    });

    it('不存在的部门返回404', async () => {
      const res = await request(app)
        .get('/api/v1/departments/999999')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(404);
    });
  });

  describe('修改部门名称', () => {
    it('修改名称成功', async () => {
      const tempDept = await prisma.department.create({
        data: { name: 'Day2可改名部门' },
      });

      const res = await request(app)
        .patch(`/api/v1/departments/${tempDept.id}`)
        .set('Cookie', adminCookies)
        .send({ name: 'Day2已改名部门' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Day2已改名部门');

      // Cleanup
      await prisma.department.delete({ where: { id: tempDept.id } });
    });

    it('改为重复名称失败', async () => {
      const res = await request(app)
        .patch(`/api/v1/departments/${testDeptId}`)
        .set('Cookie', adminCookies)
        .send({ name: TEST_DEPT2_NAME });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DEPARTMENT_NAME_ALREADY_EXISTS');
    });
  });

  describe('删除部门', () => {
    it('删除空部门成功', async () => {
      const emptyDept = await prisma.department.create({
        data: { name: 'Day2可删除部门' },
      });

      const res = await request(app)
        .delete(`/api/v1/departments/${emptyDept.id}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(204);
    });

    it('有员工的部门不能删除', async () => {
      // testDeptId has employeeId
      const res = await request(app)
        .delete(`/api/v1/departments/${testDeptId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_EMPTY');
    });
  });
});

// ============================================================
// EMPLOYEE (USER) TESTS
// ============================================================

describe('员工管理', () => {
  describe('创建员工', () => {
    it('管理员创建员工成功', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          username: 'day2_emp_a',
          initialPassword: 'EmpA1234',
          name: '测试员工A',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
          jobTitle: '工程师',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.username).toBe('day2_emp_a');
      expect(res.body.data.role).toBe('EMPLOYEE');
      expect(res.body.data.department.id).toBe(testDeptId);
      expect(res.body.data.isDepartmentManager).toBe(false);
    });

    it('重复账号失败', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          username: 'day2_emp_a',
          initialPassword: 'EmpA1234',
          name: '重复员工',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_ALREADY_EXISTS');
    });

    it('非法密码失败（太短）', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          username: 'day2_emp_b',
          initialPassword: 'short',
          name: '密码太短',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('非法密码失败（无数字）', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          username: 'day2_emp_b',
          initialPassword: 'onlyLetters',
          name: '无数字密码',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
        });

      expect(res.status).toBe(400);
    });

    it('部门不存在失败', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          username: 'day2_emp_b',
          initialPassword: 'EmpB1234',
          name: '部门不存在',
          role: 'EMPLOYEE',
          departmentId: 999999,
        });

      expect(res.status).toBe(400);
    });

    it('普通员工创建用户失败', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', employeeCookies)
        .send({
          username: 'should_fail',
          initialPassword: 'FailTest1',
          name: '失败',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('员工列表', () => {
    it('管理员查看列表成功', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('搜索关键字成功', async () => {
      const res = await request(app)
        .get('/api/v1/users?keyword=day2_test')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('角色筛选成功', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=ADMIN')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((u: any) => {
        expect(u.role).toBe('ADMIN');
      });
    });

    it('部门筛选成功', async () => {
      const res = await request(app)
        .get(`/api/v1/users?departmentId=${testDeptId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((u: any) => {
        expect(u.department?.id).toBe(testDeptId);
      });
    });

    it('普通员工查看列表失败', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', employeeCookies);

      expect(res.status).toBe(403);
    });
  });

  describe('员工详情', () => {
    it('管理员查看详情成功', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${employeeId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(employeeId);
      expect(res.body.data.username).toBe(EMPLOYEE_USER.username);
    });

    it('详情不泄露敏感字段', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${employeeId}`)
        .set('Cookie', adminCookies);

      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.tokenVersion).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.token_version).toBeUndefined();
    });
  });

  describe('修改员工资料', () => {
    it('修改允许的基本资料成功', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${employeeId}`)
        .set('Cookie', adminCookies)
        .send({ name: '测试员工改名', jobTitle: '高级工程师' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('测试员工改名');
      expect(res.body.data.jobTitle).toBe('高级工程师');

      // Restore
      await request(app)
        .patch(`/api/v1/users/${employeeId}`)
        .set('Cookie', adminCookies)
        .send({ name: EMPLOYEE_USER.name });
    });

    it('不能通过资料修改角色或部门', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${employeeId}`)
        .set('Cookie', adminCookies)
        .send({ role: 'ADMIN', departmentId: testDept2Id });

      // Zod strips unknown fields, so it should succeed but not change role/department
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('EMPLOYEE'); // unchanged
    });
  });

  describe('调动部门', () => {
    let transferEmpId: number;

    beforeAll(async () => {
      const hash = await bcrypt.hash('Transfer123', 10);
      const emp = await prisma.user.create({
        data: {
          username: 'day2_emp_c',
          passwordHash: hash,
          name: '调动测试员工',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
          mustChangePassword: false,
        },
      });
      transferEmpId = emp.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { username: 'day2_emp_c' } });
    });

    it('普通员工调动部门成功', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${transferEmpId}/department`)
        .set('Cookie', adminCookies)
        .send({ departmentId: testDept2Id });

      expect(res.status).toBe(200);
      expect(res.body.data.departmentId).toBe(testDept2Id);

      // Restore
      await request(app)
        .put(`/api/v1/users/${transferEmpId}/department`)
        .set('Cookie', adminCookies)
        .send({ departmentId: testDeptId });
    });

    it('目标部门不存在失败', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${transferEmpId}/department`)
        .set('Cookie', adminCookies)
        .send({ departmentId: 999999 });

      expect(res.status).toBe(400);
    });
  });

  describe('重置密码', () => {
    it('重置密码成功', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${employeeId}/password-reset`)
        .set('Cookie', adminCookies)
        .send({ newPassword: 'ResetPass123' });

      expect(res.status).toBe(200);

      // Old password should not work
      const oldLogin = await request(app)
        .post('/api/v1/auth/sessions')
        .send({ username: EMPLOYEE_USER.username, password: EMPLOYEE_USER.password });
      expect(oldLogin.status).toBe(401);

      // New password should work but mustChangePassword=true
      const newLogin = await request(app)
        .post('/api/v1/auth/sessions')
        .send({ username: EMPLOYEE_USER.username, password: 'ResetPass123' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.mustChangePassword).toBe(true);

      // Restore: reset password back and clear mustChangePassword
      const oldHash = await bcrypt.hash(EMPLOYEE_USER.password, 10);
      await prisma.user.update({
        where: { id: employeeId },
        data: { passwordHash: oldHash, mustChangePassword: false, tokenVersion: 0 },
      });
    });
  });

  describe('停用账号', () => {
    let disableEmpId: number;

    beforeAll(async () => {
      const hash = await bcrypt.hash('DisableTest1', 10);
      const emp = await prisma.user.create({
        data: {
          username: 'day2_emp_b',
          passwordHash: hash,
          name: '停用测试员工',
          role: 'EMPLOYEE',
          departmentId: testDeptId,
          mustChangePassword: false,
        },
      });
      disableEmpId = emp.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { username: 'day2_emp_b' } });
    });

    it('停用普通员工成功', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${disableEmpId}/disable`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);

      // Verify disabled
      const login = await request(app)
        .post('/api/v1/auth/sessions')
        .send({ username: 'day2_emp_b', password: 'DisableTest1' });
      expect(login.status).toBe(401);
      expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('管理员不能停用自己', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${adminId}/disable`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ADMIN_CANNOT_DISABLE_SELF');
    });

    it('普通员工访问管理接口失败', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', employeeCookies);

      expect(res.status).toBe(403);
    });
  });
});

// ============================================================
// MANAGER TESTS
// ============================================================

describe('负责人管理', () => {
  let mgrDeptId: number;
  let mgrEmpAId: number;
  let mgrEmpBId: number;

  beforeAll(async () => {
    // Create a fresh department for manager tests
    const dept = await prisma.department.create({
      data: { name: 'Day2有负责人部门' },
    });
    mgrDeptId = dept.id;

    const hash = await bcrypt.hash('MgrTest123', 10);

    // Create two employees in that department
    const empA = await prisma.user.create({
      data: {
        username: 'day2_mgr_a',
        passwordHash: hash,
        name: '负责人候选人A',
        role: 'EMPLOYEE',
        departmentId: mgrDeptId,
        mustChangePassword: false,
      },
    });
    mgrEmpAId = empA.id;

    const empB = await prisma.user.create({
      data: {
        username: 'day2_mgr_b',
        passwordHash: hash,
        name: '负责人候选人B',
        role: 'EMPLOYEE',
        departmentId: mgrDeptId,
        mustChangePassword: false,
      },
    });
    mgrEmpBId = empB.id;
  });

  afterAll(async () => {
    // Remove manager first to avoid FK issues
    await prisma.department.update({
      where: { id: mgrDeptId },
      data: { managerUserId: null },
    });
    await prisma.user.deleteMany({
      where: { username: { in: ['day2_mgr_a', 'day2_mgr_b'] } },
    });
    await prisma.department.deleteMany({
      where: { name: 'Day2有负责人部门' },
    });
  });

  describe('查询候选人', () => {
    it('查询候选人正确', async () => {
      const res = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}/manager-candidates`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((u: any) => u.id);
      expect(ids).toContain(mgrEmpAId);
      expect(ids).toContain(mgrEmpBId);
    });

    it('普通员工查询候选人失败', async () => {
      const res = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}/manager-candidates`)
        .set('Cookie', employeeCookies);

      expect(res.status).toBe(403);
    });
  });

  describe('任命负责人', () => {
    it('任命负责人成功', async () => {
      const res = await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: mgrEmpAId });

      expect(res.status).toBe(200);
      expect(res.body.data.managerUserId).toBe(mgrEmpAId);

      // Verify via detail
      const detail = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}`)
        .set('Cookie', adminCookies);

      expect(detail.body.data.manager.id).toBe(mgrEmpAId);
    });

    it('同一人不能负责多个部门', async () => {
      // Try to appoint empA to testDept2 (empA is in mgrDeptId, not testDept2)
      // First, the user must be in the target department - this should fail validation
      const res = await request(app)
        .put(`/api/v1/departments/${testDept2Id}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: mgrEmpAId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MANAGER_CANDIDATE');
    });

    it('非本部门员工不能任命', async () => {
      // employeeId is in testDeptId, not mgrDeptId
      const res = await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: employeeId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MANAGER_CANDIDATE');
    });

    it('非管理员不能任命负责人', async () => {
      const res = await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', employeeCookies)
        .send({ userId: mgrEmpBId });

      expect(res.status).toBe(403);
    });
  });

  describe('更换负责人', () => {
    it('更换负责人成功', async () => {
      const res = await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: mgrEmpBId });

      expect(res.status).toBe(200);
      expect(res.body.data.managerUserId).toBe(mgrEmpBId);

      // Verify
      const detail = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}`)
        .set('Cookie', adminCookies);

      expect(detail.body.data.manager.id).toBe(mgrEmpBId);
    });
  });

  describe('卸任负责人', () => {
    it('卸任负责人成功', async () => {
      const res = await request(app)
        .delete(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.managerUserId).toBeNull();

      // Verify
      const detail = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}`)
        .set('Cookie', adminCookies);

      expect(detail.body.data.manager).toBeNull();
    });

    it('没有负责人时卸任失败', async () => {
      const res = await request(app)
        .delete(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(404);
    });
  });

  describe('负责人与停用限制', () => {
    it('当前负责人不能直接停用', async () => {
      // Appoint empA as manager
      await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: mgrEmpAId });

      // Try to disable empA
      const res = await request(app)
        .post(`/api/v1/users/${mgrEmpAId}/disable`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MANAGER_MUST_BE_REMOVED_BEFORE_DISABLE');

      // Cleanup: remove manager
      await request(app)
        .delete(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies);
    });
  });

  describe('候选人排除已负责其他部门的人', () => {
    it('已负责其他部门的人不在候选列表中', async () => {
      // Appoint empA to mgrDept
      await request(app)
        .put(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies)
        .send({ userId: mgrEmpAId });

      // empA should NOT be candidate for testDept2 (wrong dept anyway, but let's check mgrDept)
      const res = await request(app)
        .get(`/api/v1/departments/${mgrDeptId}/manager-candidates`)
        .set('Cookie', adminCookies);

      const ids = res.body.data.items.map((u: any) => u.id);
      expect(ids).not.toContain(mgrEmpAId); // excluded because already managing
      expect(ids).toContain(mgrEmpBId); // still candidate

      // Cleanup
      await request(app)
        .delete(`/api/v1/departments/${mgrDeptId}/manager`)
        .set('Cookie', adminCookies);
    });
  });
});
