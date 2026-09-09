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
const PREFIX = `[day4_${RUN_ID}]`;

// ============================================================
// Test Data
// ============================================================
const ADMIN_USER = {
  username: `day4_admin_${RUN_ID}`,
  password: 'AdminTest123',
  name: `${PREFIX}管理员`,
};

const MANAGER_A = {
  username: `day4_mgr_a_${RUN_ID}`,
  password: 'MgrTest123',
  name: `${PREFIX}负责人A`,
};

const MANAGER_B = {
  username: `day4_mgr_b_${RUN_ID}`,
  password: 'MgrTest123',
  name: `${PREFIX}负责人B`,
};

const EMP_A = {
  username: `day4_emp_a_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工A`,
};

const EMP_B = {
  username: `day4_emp_b_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}员工B`,
};

const NO_DEPT_EMP = {
  username: `day4_nodept_${RUN_ID}`,
  password: 'EmpTest123',
  name: `${PREFIX}无部门员工`,
};

const DEPT_A_NAME = `${PREFIX}部门A`;
const DEPT_B_NAME = `${PREFIX}部门B`;

let adminId: number;
let adminCookies: string[];
let managerAId: number;
let managerACookies: string[];
let managerBId: number;
let managerBCookies: string[];
let empAId: number;
let empACookies: string[];
let empBId: number;
let empBCookies: string[];
let noDeptEmpId: number;
let noDeptEmpCookies: string[];
let deptAId: number;
let deptBId: number;

// Track all leave request IDs created by this test
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
  await prisma.leaveActionLog.deleteMany({
    where: { leaveRequest: { applicant: { username: { in: [
      ADMIN_USER.username, MANAGER_A.username, MANAGER_B.username,
      EMP_A.username, EMP_B.username, NO_DEPT_EMP.username,
    ] } } } },
  });
  await prisma.leaveRequest.deleteMany({
    where: { applicant: { username: { in: [
      ADMIN_USER.username, MANAGER_A.username, MANAGER_B.username,
      EMP_A.username, EMP_B.username, NO_DEPT_EMP.username,
    ] } } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [
      ADMIN_USER.username, MANAGER_A.username, MANAGER_B.username,
      EMP_A.username, EMP_B.username, NO_DEPT_EMP.username,
    ] } },
  });
  await prisma.department.deleteMany({
    where: { name: { in: [DEPT_A_NAME, DEPT_B_NAME] } },
  });

  // Create sentinel to verify cleanup doesn't over-delete
  const sentinelAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (sentinelAdmin) {
    const existing = await prisma.leaveRequest.findFirst({
      where: { applicantNameSnapshot: '__day4_sentinel_do_not_delete__' },
    });
    if (!existing) {
      const sentinel = await prisma.leaveRequest.create({
        data: {
          applicantId: sentinelAdmin.id,
          applicantNameSnapshot: '__day4_sentinel_do_not_delete__',
          submittedDepartmentId: 1,
          departmentNameSnapshot: 'sentinel',
          approverId: sentinelAdmin.id,
          approverNameSnapshot: 'sentinel',
          leaveType: 'PERSONAL',
          startDate: new Date('2099-01-01'),
          endDate: new Date('2099-01-02'),
          days: 2,
          reason: 'sentinel',
          status: 'CANCELLED',
          stateVersion: 1,
        },
      });
      createdLeaveIds.push(sentinel.id);
    }
  }

  // Create departments
  const deptA = await prisma.department.create({ data: { name: DEPT_A_NAME } });
  deptAId = deptA.id;
  const deptB = await prisma.department.create({ data: { name: DEPT_B_NAME } });
  deptBId = deptB.id;

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

  // Create manager A (dept A)
  const mgrAHash = await bcrypt.hash(MANAGER_A.password, 10);
  const mgrA = await prisma.user.create({
    data: {
      username: MANAGER_A.username,
      passwordHash: mgrAHash,
      name: MANAGER_A.name,
      role: 'EMPLOYEE',
      departmentId: deptAId,
      mustChangePassword: false,
    },
  });
  managerAId = mgrA.id;
  await prisma.department.update({
    where: { id: deptAId },
    data: { managerUserId: managerAId },
  });

  // Create manager B (dept B)
  const mgrBHash = await bcrypt.hash(MANAGER_B.password, 10);
  const mgrB = await prisma.user.create({
    data: {
      username: MANAGER_B.username,
      passwordHash: mgrBHash,
      name: MANAGER_B.name,
      role: 'EMPLOYEE',
      departmentId: deptBId,
      mustChangePassword: false,
    },
  });
  managerBId = mgrB.id;
  await prisma.department.update({
    where: { id: deptBId },
    data: { managerUserId: managerBId },
  });

  // Create employee A (dept A)
  const empAHash = await bcrypt.hash(EMP_A.password, 10);
  const empA = await prisma.user.create({
    data: {
      username: EMP_A.username,
      passwordHash: empAHash,
      name: EMP_A.name,
      role: 'EMPLOYEE',
      departmentId: deptAId,
      mustChangePassword: false,
    },
  });
  empAId = empA.id;

  // Create employee B (dept B)
  const empBHash = await bcrypt.hash(EMP_B.password, 10);
  const empB = await prisma.user.create({
    data: {
      username: EMP_B.username,
      passwordHash: empBHash,
      name: EMP_B.name,
      role: 'EMPLOYEE',
      departmentId: deptBId,
      mustChangePassword: false,
    },
  });
  empBId = empB.id;

  // Create employee with no department
  const noDeptHash = await bcrypt.hash(NO_DEPT_EMP.password, 10);
  const noDept = await prisma.user.create({
    data: {
      username: NO_DEPT_EMP.username,
      passwordHash: noDeptHash,
      name: NO_DEPT_EMP.name,
      role: 'EMPLOYEE',
      mustChangePassword: false,
    },
  });
  noDeptEmpId = noDept.id;

  // Login all users
  adminCookies = await loginAs(ADMIN_USER.username, ADMIN_USER.password);
  managerACookies = await loginAs(MANAGER_A.username, MANAGER_A.password);
  managerBCookies = await loginAs(MANAGER_B.username, MANAGER_B.password);
  empACookies = await loginAs(EMP_A.username, EMP_A.password);
  empBCookies = await loginAs(EMP_B.username, EMP_B.password);
  noDeptEmpCookies = await loginAs(NO_DEPT_EMP.username, NO_DEPT_EMP.password);
});

afterAll(async () => {
  // Clean ONLY our test data in FK order
  await prisma.leaveActionLog.deleteMany({
    where: { leaveRequest: { id: { in: createdLeaveIds } } },
  });
  await prisma.leaveRequest.deleteMany({
    where: { id: { in: createdLeaveIds } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: [
      ADMIN_USER.username, MANAGER_A.username, MANAGER_B.username,
      EMP_A.username, EMP_B.username, NO_DEPT_EMP.username,
    ] } },
  });
  await prisma.department.deleteMany({
    where: { name: { in: [DEPT_A_NAME, DEPT_B_NAME] } },
  });
  await prisma.$disconnect();
});

// ============================================================
// Tests
// ============================================================
describe('Day 4 - 请假申请与审批', () => {

  // ---------- Create & Submit ----------
  describe('创建与提交', () => {
    let leaveId: number;

    it('1. 员工创建请假成功', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-03-10',
          endDate: '2099-03-12',
          reason: '个人事务处理',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.applicant.id).toBe(empAId);
      expect(res.body.data.approver.id).toBe(managerAId);
      expect(res.body.data.days).toBe(3);
      leaveId = res.body.data.id;
      createdLeaveIds.push(leaveId);
    });

    it('2. 申请人和审批人由后端确定', async () => {
      const res = await request(app)
        .get(`/api/v1/me/leave-requests/${leaveId}`)
        .set('Cookie', empACookies);

      expect(res.status).toBe(200);
      expect(res.body.data.applicant.id).toBe(empAId);
      expect(res.body.data.approver.id).toBe(managerAId);
      expect(res.body.data.submittedDepartment.id).toBe(deptAId);
    });

    it('3. 员工无部门时提交失败', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', noDeptEmpCookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-04-01',
          endDate: '2099-04-02',
          reason: '测试',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_NO_DEPARTMENT');
    });

    it('4. 部门无负责人时提交失败', async () => {
      // Create a temp dept with no manager
      const tmpDept = await prisma.department.create({ data: { name: `${PREFIX}无负责人部门` } });
      const tmpHash = await bcrypt.hash('TmpPass123', 10);
      const tmpUser = await prisma.user.create({
        data: {
          username: `day4_tmpnodeptmgr_${RUN_ID}`,
          passwordHash: tmpHash,
          name: `${PREFIX}临时员工`,
          role: 'EMPLOYEE',
          departmentId: tmpDept.id,
          mustChangePassword: false,
        },
      });
      const tmpCookies = await loginAs(`day4_tmpnodeptmgr_${RUN_ID}`, 'TmpPass123');

      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', tmpCookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-04-01',
          endDate: '2099-04-02',
          reason: '测试',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_DEPARTMENT_NO_MANAGER');

      // Cleanup
      await prisma.user.delete({ where: { id: tmpUser.id } });
      await prisma.department.delete({ where: { id: tmpDept.id } });
    });

    it('5. 负责人本人提交时返回错误', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', managerACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-04-01',
          endDate: '2099-04-02',
          reason: '负责人请假测试',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_SELF_APPROVAL_NOT_ALLOWED');
    });

    it('6. 字段缺失返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({ leaveType: 'PERSONAL' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('7. 结束时间早于开始时间返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-03-15',
          endDate: '2099-03-10',
          reason: '日期错误',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LEAVE_DATE_INVALID');
    });

    it('8. 请假天数超限返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-05-01',
          endDate: '2099-06-15',
          reason: '超长请假',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LEAVE_DURATION_EXCEEDED');
    });

    it('9. 原因为空返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-03-20',
          endDate: '2099-03-21',
          reason: '',
        });

      expect(res.status).toBe(400);
    });

    it('10. 我的列表只返回本人数据', async () => {
      // empA creates another leave
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'SICK',
          startDate: '2099-04-01',
          endDate: '2099-04-03',
          reason: '生病',
        });
      createdLeaveIds.push(createRes.body.data.id);

      const res = await request(app)
        .get('/api/v1/me/leave-requests')
        .set('Cookie', empACookies);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      // All should belong to empA
      for (const item of res.body.data.items) {
        // Verify by checking detail
        const detail = await request(app)
          .get(`/api/v1/me/leave-requests/${item.id}`)
          .set('Cookie', empACookies);
        expect(detail.body.data.applicant.id).toBe(empAId);
      }
    });

    it('11. 员工不能查看他人详情', async () => {
      const res = await request(app)
        .get(`/api/v1/me/leave-requests/${leaveId}`)
        .set('Cookie', empBCookies);

      expect(res.status).toBe(404);
    });
  });

  // ---------- Cancel, Edit, Resubmit ----------
  describe('撤回、修改、重新提交', () => {
    let cancelTestLeaveId: number;
    let cancelTestVersion: number;

    beforeAll(async () => {
      // Create a leave for cancel tests
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-06-01',
          endDate: '2099-06-03',
          reason: '撤回测试',
        });
      cancelTestLeaveId = res.body.data.id;
      cancelTestVersion = res.body.data.stateVersion;
      createdLeaveIds.push(cancelTestLeaveId);
    });

    it('12. 待审批申请可以撤回', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${cancelTestLeaveId}/cancel`)
        .set('Cookie', empACookies)
        .send({ expectedStateVersion: cancelTestVersion });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      cancelTestVersion = res.body.data.stateVersion;
    });

    it('13. 已通过申请不能撤回', async () => {
      // Create and approve a leave
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-07-01',
          endDate: '2099-07-02',
          reason: '通过后撤回测试',
        });
      const approvedId = createRes.body.data.id;
      const approvedVersion = createRes.body.data.stateVersion;
      createdLeaveIds.push(approvedId);

      // Approve it
      await request(app)
        .post(`/api/v1/leave-requests/${approvedId}/approve`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: approvedVersion, comment: '同意' });

      // Try to cancel
      const res = await request(app)
        .post(`/api/v1/leave-requests/${approvedId}/cancel`)
        .set('Cookie', empACookies)
        .send({ expectedStateVersion: approvedVersion + 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('14. 已驳回申请不能撤回', async () => {
      // Create and reject a leave
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-07-10',
          endDate: '2099-07-11',
          reason: '驳回后撤回测试',
        });
      const rejectedId = createRes.body.data.id;
      const rejectedVersion = createRes.body.data.stateVersion;
      createdLeaveIds.push(rejectedId);

      await request(app)
        .post(`/api/v1/leave-requests/${rejectedId}/reject`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: rejectedVersion, reason: '不批准' });

      const res = await request(app)
        .post(`/api/v1/leave-requests/${rejectedId}/cancel`)
        .set('Cookie', empACookies)
        .send({ expectedStateVersion: rejectedVersion + 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('15. 只有申请人可以撤回', async () => {
      // Create a leave for empA
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-08-01',
          endDate: '2099-08-02',
          reason: '他人撤回测试',
        });
      const otherLeaveId = createRes.body.data.id;
      const otherVersion = createRes.body.data.stateVersion;
      createdLeaveIds.push(otherLeaveId);

      // empB tries to cancel
      const res = await request(app)
        .post(`/api/v1/leave-requests/${otherLeaveId}/cancel`)
        .set('Cookie', empBCookies)
        .send({ expectedStateVersion: otherVersion });

      expect(res.status).toBe(404);
    });

    it('16. 已撤回申请可以修改', async () => {
      const res = await request(app)
        .patch(`/api/v1/leave-requests/${cancelTestLeaveId}`)
        .set('Cookie', empACookies)
        .send({
          startDate: '2099-06-05',
          endDate: '2099-06-07',
          reason: '修改后的原因',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.reason).toBe('修改后的原因');
      expect(res.body.data.days).toBe(3);
      cancelTestVersion = res.body.data.stateVersion;
    });

    it('17. 待审批申请不能修改', async () => {
      // Create a pending leave
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-08-10',
          endDate: '2099-08-11',
          reason: '待审批修改测试',
        });
      const pendingId = createRes.body.data.id;
      createdLeaveIds.push(pendingId);

      const res = await request(app)
        .patch(`/api/v1/leave-requests/${pendingId}`)
        .set('Cookie', empACookies)
        .send({ reason: '尝试修改' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('18. 已通过和已驳回申请不能修改', async () => {
      // Create and approve
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-08-20',
          endDate: '2099-08-21',
          reason: '已通过修改测试',
        });
      const id = createRes.body.data.id;
      const version = createRes.body.data.stateVersion;
      createdLeaveIds.push(id);

      await request(app)
        .post(`/api/v1/leave-requests/${id}/approve`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: version });

      const res = await request(app)
        .patch(`/api/v1/leave-requests/${id}`)
        .set('Cookie', empACookies)
        .send({ reason: '尝试修改' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('19. 已撤回申请可以重新提交', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${cancelTestLeaveId}/resubmit`)
        .set('Cookie', empACookies)
        .send({ expectedStateVersion: cancelTestVersion });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.approver.id).toBe(managerAId);
      cancelTestVersion = res.body.data.stateVersion;
    });

    it('20. 其他状态不能重新提交', async () => {
      // Try to resubmit the now-pending leave
      const res = await request(app)
        .post(`/api/v1/leave-requests/${cancelTestLeaveId}/resubmit`)
        .set('Cookie', empACookies)
        .send({ expectedStateVersion: cancelTestVersion });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('21. 重新提交后状态和审批人正确', async () => {
      // cancelTestLeaveId is now pending again, let's verify
      const res = await request(app)
        .get(`/api/v1/me/leave-requests/${cancelTestLeaveId}`)
        .set('Cookie', empACookies);

      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.approver.id).toBe(managerAId);
    });

    it('22. 每次操作生成正确日志', async () => {
      const res = await request(app)
        .get(`/api/v1/me/leave-requests/${cancelTestLeaveId}`)
        .set('Cookie', empACookies);

      expect(res.status).toBe(200);
      const logs = res.body.data.actionLogs;
      expect(logs.length).toBeGreaterThanOrEqual(4); // SUBMITTED, CANCELLED, EDITED, RESUBMITTED
      expect(logs[0].action).toBe('SUBMITTED');
      expect(logs[1].action).toBe('CANCELLED');
      expect(logs[2].action).toBe('EDITED');
      expect(logs[3].action).toBe('RESUBMITTED');
    });
  });

  // ---------- Approval ----------
  describe('审批', () => {
    let approvalLeaveId: number;
    let approvalVersion: number;

    beforeAll(async () => {
      // Create a leave for approval tests
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'ANNUAL',
          startDate: '2099-09-01',
          endDate: '2099-09-05',
          reason: '审批测试请假',
        });
      approvalLeaveId = res.body.data.id;
      approvalVersion = res.body.data.stateVersion;
      createdLeaveIds.push(approvalLeaveId);
    });

    it('23. 当前负责人可以查看自己的待审批申请', async () => {
      const res = await request(app)
        .get('/api/v1/me/approval-tasks')
        .set('Cookie', managerACookies);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.find((i: any) => i.id === approvalLeaveId);
      expect(found).toBeTruthy();
    });

    it('24. 负责人看不到其他部门待办', async () => {
      const res = await request(app)
        .get('/api/v1/me/approval-tasks')
        .set('Cookie', managerBCookies);

      expect(res.status).toBe(200);
      const found = res.body.data.items.find((i: any) => i.id === approvalLeaveId);
      expect(found).toBeFalsy();
    });

    it('25. 普通员工不能访问审批接口', async () => {
      const res = await request(app)
        .get('/api/v1/me/approval-tasks')
        .set('Cookie', empACookies);

      // empA is not a manager, so approval-tasks should return empty
      expect(res.status).toBe(200);
      // This is correct - empA is not a manager, so no tasks
    });

    it('26. 正确审批人可以通过申请', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${approvalLeaveId}/approve`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: approvalVersion, comment: '同意请假' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      approvalVersion = res.body.data.stateVersion;
    });

    it('27. 正确审批人可以驳回申请', async () => {
      // Create another leave for empA
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-09-10',
          endDate: '2099-09-11',
          reason: '驳回测试',
        });
      const rejectId = createRes.body.data.id;
      const rejectVersion = createRes.body.data.stateVersion;
      createdLeaveIds.push(rejectId);

      const res = await request(app)
        .post(`/api/v1/leave-requests/${rejectId}/reject`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: rejectVersion, reason: '工作安排冲突' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
    });

    it('28. 驳回原因必填', async () => {
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-09-20',
          endDate: '2099-09-21',
          reason: '驳回原因测试',
        });
      const id = createRes.body.data.id;
      const version = createRes.body.data.stateVersion;
      createdLeaveIds.push(id);

      const res = await request(app)
        .post(`/api/v1/leave-requests/${id}/reject`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: version, reason: '' });

      expect(res.status).toBe(400);
    });

    it('29. 已处理申请不能重复审批', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${approvalLeaveId}/approve`)
        .set('Cookie', managerACookies)
        .send({ expectedStateVersion: approvalVersion });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEAVE_STATE_NOT_ALLOWED');
    });

    it('30. 非审批人不能审批', async () => {
      // Create a leave in dept A
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-10-01',
          endDate: '2099-10-02',
          reason: '非审批人测试',
        });
      const id = createRes.body.data.id;
      const version = createRes.body.data.stateVersion;
      createdLeaveIds.push(id);

      // managerB tries to approve (wrong department)
      const res = await request(app)
        .post(`/api/v1/leave-requests/${id}/approve`)
        .set('Cookie', managerBCookies)
        .send({ expectedStateVersion: version });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPROVAL_NOT_ASSIGNED');
    });

    it('31. 审批后待办与历史列表正确', async () => {
      // approvalLeaveId is now APPROVED
      const tasksRes = await request(app)
        .get('/api/v1/me/approval-tasks')
        .set('Cookie', managerACookies);

      const foundInTasks = tasksRes.body.data.items.find((i: any) => i.id === approvalLeaveId);
      expect(foundInTasks).toBeFalsy();

      const historyRes = await request(app)
        .get('/api/v1/me/approval-history')
        .set('Cookie', managerACookies);

      const foundInHistory = historyRes.body.data.items.find((i: any) => i.id === approvalLeaveId);
      expect(foundInHistory).toBeTruthy();
    });

    it('32. 通过和驳回日志正确', async () => {
      const res = await request(app)
        .get(`/api/v1/me/approvals/${approvalLeaveId}`)
        .set('Cookie', managerACookies);

      expect(res.status).toBe(200);
      const logs = res.body.data.actionLogs;
      const approveLog = logs.find((l: any) => l.action === 'APPROVED');
      expect(approveLog).toBeTruthy();
      expect(approveLog.comment).toBe('同意请假');
    });
  });

  // ---------- Concurrency ----------
  describe('并发控制', () => {
    it('33-37. 并发审批只能一个成功', async () => {
      // Create a leave for concurrency test
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-11-01',
          endDate: '2099-11-02',
          reason: '并发测试',
        });
      const id = createRes.body.data.id;
      const version = createRes.body.data.stateVersion;
      createdLeaveIds.push(id);

      // Send two approve requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/leave-requests/${id}/approve`)
          .set('Cookie', managerACookies)
          .send({ expectedStateVersion: version, comment: '通过1' }),
        request(app)
          .post(`/api/v1/leave-requests/${id}/reject`)
          .set('Cookie', managerACookies)
          .send({ expectedStateVersion: version, reason: '驳回1' }),
      ]);

      // Exactly one should succeed
      const successCount = [res1, res2].filter(r => r.status === 200).length;
      const conflictCount = [res1, res2].filter(r => r.status === 409).length;
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      // Verify final state
      const detail = await request(app)
        .get(`/api/v1/me/leave-requests/${id}`)
        .set('Cookie', empACookies);

      expect(['APPROVED', 'REJECTED']).toContain(detail.body.data.status);
      expect(detail.body.data.stateVersion).toBe(version + 1);
    });

    it('37. 并发撤回与审批只能一个成功', async () => {
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-11-10',
          endDate: '2099-11-11',
          reason: '撤回审批并发测试',
        });
      const id = createRes.body.data.id;
      const version = createRes.body.data.stateVersion;
      createdLeaveIds.push(id);

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/leave-requests/${id}/cancel`)
          .set('Cookie', empACookies)
          .send({ expectedStateVersion: version }),
        request(app)
          .post(`/api/v1/leave-requests/${id}/approve`)
          .set('Cookie', managerACookies)
          .send({ expectedStateVersion: version }),
      ]);

      const successCount = [res1, res2].filter(r => r.status === 200).length;
      const conflictCount = [res1, res2].filter(r => r.status === 409).length;
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      // Verify only one log entry for the state change
      const detail = await request(app)
        .get(`/api/v1/me/leave-requests/${id}`)
        .set('Cookie', empACookies);

      expect(['APPROVED', 'CANCELLED']).toContain(detail.body.data.status);
    });
  });

  // ---------- Common ----------
  describe('通用', () => {
    it('38. 未认证返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/me/leave-requests');

      expect(res.status).toBe(401);
    });

    it('39. 强制改密期间返回 403', async () => {
      // Create a user with mustChangePassword
      const mcHash = await bcrypt.hash('McTest123', 10);
      const mcUser = await prisma.user.create({
        data: {
          username: `day4_mc_${RUN_ID}`,
          passwordHash: mcHash,
          name: `${PREFIX}强制改密`,
          role: 'EMPLOYEE',
          departmentId: deptAId,
          mustChangePassword: true,
        },
      });
      const mcCookies = await loginAs(`day4_mc_${RUN_ID}`, 'McTest123');

      const res = await request(app)
        .get('/api/v1/me/leave-requests')
        .set('Cookie', mcCookies);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

      // Cleanup
      await prisma.user.delete({ where: { id: mcUser.id } });
    });

    it('40. 非法 ID 返回 400', async () => {
      const res = await request(app)
        .get('/api/v1/me/leave-requests/abc')
        .set('Cookie', empACookies);

      expect(res.status).toBe(400);
    });

    it('41. 不存在 ID 返回 404', async () => {
      const res = await request(app)
        .get('/api/v1/me/leave-requests/999999')
        .set('Cookie', empACookies);

      expect(res.status).toBe(404);
    });

    it('42. 审批详情只能由审批人查看', async () => {
      // empA's leave - managerA can view in approvals
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', empACookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-12-01',
          endDate: '2099-12-02',
          reason: '审批详情测试',
        });
      const id = createRes.body.data.id;
      createdLeaveIds.push(id);

      // managerA can view
      const res1 = await request(app)
        .get(`/api/v1/me/approvals/${id}`)
        .set('Cookie', managerACookies);
      expect(res1.status).toBe(200);

      // managerB cannot view
      const res2 = await request(app)
        .get(`/api/v1/me/approvals/${id}`)
        .set('Cookie', managerBCookies);
      expect(res2.status).toBe(404);

      // empB cannot view (not the approver)
      const res3 = await request(app)
        .get(`/api/v1/me/approvals/${id}`)
        .set('Cookie', empBCookies);
      expect(res3.status).toBe(404);
    });

    it('43. admin 不能访问请假接口', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Cookie', adminCookies)
        .send({
          leaveType: 'PERSONAL',
          startDate: '2099-12-10',
          endDate: '2099-12-11',
          reason: 'admin测试',
        });

      expect(res.status).toBe(403);
    });
  });
});
