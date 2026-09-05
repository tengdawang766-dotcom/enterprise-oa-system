import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeAll, afterAll } from 'vitest';

const prisma = new PrismaClient();

// Test user credentials
export const TEST_ADMIN = {
  username: 'test_admin',
  password: 'testAdmin123',
  name: '测试管理员',
};

export const TEST_EMPLOYEE = {
  username: 'test_employee',
  password: 'testEmp123',
  name: '测试员工',
};

export const TEST_EMPLOYEE_DISABLED = {
  username: 'test_disabled',
  password: 'testDisabled123',
  name: '测试停用',
};

let adminId: number;
let employeeId: number;
let disabledId: number;
let departmentId: number;

export async function setupTestData() {
  // Create test department
  const dept = await prisma.department.upsert({
    where: { name: '测试部' },
    update: {},
    create: { name: '测试部' },
  });
  departmentId = dept.id;

  // Create test admin
  const adminHash = await bcrypt.hash(TEST_ADMIN.password, 10);
  const admin = await prisma.user.upsert({
    where: { username: TEST_ADMIN.username },
    update: { passwordHash: adminHash, mustChangePassword: true, status: 'ENABLED' },
    create: {
      username: TEST_ADMIN.username,
      passwordHash: adminHash,
      name: TEST_ADMIN.name,
      role: 'ADMIN',
      mustChangePassword: true,
    },
  });
  adminId = admin.id;

  // Create test employee
  const empHash = await bcrypt.hash(TEST_EMPLOYEE.password, 10);
  const emp = await prisma.user.upsert({
    where: { username: TEST_EMPLOYEE.username },
    update: { passwordHash: empHash, mustChangePassword: true, status: 'ENABLED', departmentId: dept.id },
    create: {
      username: TEST_EMPLOYEE.username,
      passwordHash: empHash,
      name: TEST_EMPLOYEE.name,
      role: 'EMPLOYEE',
      departmentId: dept.id,
      mustChangePassword: true,
    },
  });
  employeeId = emp.id;

  // Create disabled employee
  const disHash = await bcrypt.hash(TEST_EMPLOYEE_DISABLED.password, 10);
  const dis = await prisma.user.upsert({
    where: { username: TEST_EMPLOYEE_DISABLED.username },
    update: { passwordHash: disHash, status: 'DISABLED' },
    create: {
      username: TEST_EMPLOYEE_DISABLED.username,
      passwordHash: disHash,
      name: TEST_EMPLOYEE_DISABLED.name,
      role: 'EMPLOYEE',
      departmentId: dept.id,
      status: 'DISABLED',
      mustChangePassword: false,
    },
  });
  disabledId = dis.id;

  return { adminId, employeeId, disabledId, departmentId };
}

export async function cleanupTestData() {
  // Delete test data in correct order (respect foreign keys)
  await prisma.leaveActionLog.deleteMany({
    where: {
      OR: [
        { operatorId: adminId },
        { operatorId: employeeId },
        { operatorId: disabledId },
      ],
    },
  });
  await prisma.leaveRequest.deleteMany({
    where: {
      OR: [
        { applicantId: adminId },
        { applicantId: employeeId },
        { approverId: adminId },
      ],
    },
  });
  await prisma.announcementRead.deleteMany({
    where: {
      OR: [
        { userId: adminId },
        { userId: employeeId },
      ],
    },
  });
  await prisma.announcement.deleteMany({
    where: { publisherId: adminId },
  });
  
  // Reset department manager
  await prisma.department.updateMany({
    where: { managerUserId: { in: [adminId, employeeId, disabledId] } },
    data: { managerUserId: null },
  });

  // Delete users
  await prisma.user.deleteMany({
    where: {
      username: {
        in: [TEST_ADMIN.username, TEST_EMPLOYEE.username, TEST_EMPLOYEE_DISABLED.username],
      },
    },
  });

  // Delete department
  await prisma.department.deleteMany({
    where: { name: '测试部' },
  });
}

export function getAdminId() { return adminId; }
export function getEmployeeId() { return employeeId; }
export function getDisabledId() { return disabledId; }
export function getDepartmentId() { return departmentId; }
