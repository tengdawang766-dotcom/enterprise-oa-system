/**
 * Demo/Development Seed Data for OA System
 * ==========================================
 * WARNING: This file contains DEMO credentials and data.
 *           Do NOT use these passwords in production.
 *           All demo users have mustChangePassword: true.
 *
 * This seed is idempotent — safe to run multiple times.
 * It uses upsert so it will NOT overwrite existing passwords or data.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seeding demo data (DEVELOPMENT ONLY) ===\n');

  // ---------------------------------------------------------------------------
  // 1. Admin user — credentials: admin / admin123
  // ---------------------------------------------------------------------------
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      name: '系统管理员',
      role: 'ADMIN',
      mustChangePassword: true,
    },
  });
  console.log('[user] admin (系统管理员) — id:', admin.id);

  // ---------------------------------------------------------------------------
  // 2. Departments
  // ---------------------------------------------------------------------------
  const techDept = await prisma.department.upsert({
    where: { name: '技术部' },
    update: {},
    create: { name: '技术部' },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: '人事部' },
    update: {},
    create: { name: '人事部' },
  });

  console.log('[dept] 技术部 — id:', techDept.id);
  console.log('[dept] 人事部 — id:', hrDept.id);

  // ---------------------------------------------------------------------------
  // 3. Employees
  //    All use password "employee123" (mustChangePassword: true)
  // ---------------------------------------------------------------------------

  // zhangsan — 技术部 manager, credentials: zhangsan / employee123
  const empPassword = await bcrypt.hash('employee123', 10);
  const zhangsan = await prisma.user.upsert({
    where: { username: 'zhangsan' },
    update: {},
    create: {
      username: 'zhangsan',
      passwordHash: empPassword,
      name: '张三',
      role: 'EMPLOYEE',
      departmentId: techDept.id,
      jobTitle: '前端工程师',
      workEmail: 'zhangsan@example.com',
      phone: '13800138001',
      mustChangePassword: true,
    },
  });
  console.log('[user] zhangsan (张三) — id:', zhangsan.id);

  // lisi — 技术部, credentials: lisi / employee123
  const lisi = await prisma.user.upsert({
    where: { username: 'lisi' },
    update: {},
    create: {
      username: 'lisi',
      passwordHash: empPassword,
      name: '李四',
      role: 'EMPLOYEE',
      departmentId: techDept.id,
      jobTitle: '后端工程师',
      workEmail: 'lisi@example.com',
      phone: '13800138002',
      mustChangePassword: true,
    },
  });
  console.log('[user] lisi (李四) — id:', lisi.id);

  // wangwu — 人事部, credentials: wangwu / employee123
  const wangwu = await prisma.user.upsert({
    where: { username: 'wangwu' },
    update: {},
    create: {
      username: 'wangwu',
      passwordHash: empPassword,
      name: '王五',
      role: 'EMPLOYEE',
      departmentId: hrDept.id,
      jobTitle: '人事专员',
      workEmail: 'wangwu@example.com',
      phone: '13800138003',
      mustChangePassword: true,
    },
  });
  console.log('[user] wangwu (王五) — id:', wangwu.id);

  // ---------------------------------------------------------------------------
  // 4. Set zhangsan as 技术部 manager
  // ---------------------------------------------------------------------------
  await prisma.department.update({
    where: { id: techDept.id },
    data: { managerUserId: zhangsan.id },
  });
  console.log('[dept] 技术部 manager set to zhangsan');

  // ---------------------------------------------------------------------------
  // 5. Announcements
  // ---------------------------------------------------------------------------

  // 5a. A published announcement (visible to all)
  const publishedAnn = await prisma.announcement.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: '2026年中秋节放假通知',
      content:
        '根据国家法定节假日安排，2026年中秋节放假时间为9月15日至9月17日，共3天。请各部门提前做好工作交接。祝大家节日快乐！',
      status: 'PUBLISHED',
      publisherId: admin.id,
      publishedAt: new Date('2026-09-01T09:00:00'),
    },
  });
  console.log('[announcement] published:', publishedAnn.title, '— id:', publishedAnn.id);

  // 5b. Mark the published announcement as read by zhangsan (but NOT by lisi)
  await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: publishedAnn.id,
        userId: zhangsan.id,
      },
    },
    update: {},
    create: {
      announcementId: publishedAnn.id,
      userId: zhangsan.id,
      firstReadAt: new Date('2026-09-02T10:30:00'),
    },
  });
  console.log('[read] zhangsan has read the published announcement (lisi has NOT)');

  // ---------------------------------------------------------------------------
  // 6. Leave Requests — various statuses
  //    Uses future dates (2099-xx-xx) so they won't conflict with real data.
  // ---------------------------------------------------------------------------

  // 6a. PENDING — lisi requests leave, awaiting zhangsan's approval
  const leave1 = await prisma.leaveRequest.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      applicantId: lisi.id,
      applicantNameSnapshot: lisi.name,
      submittedDepartmentId: techDept.id,
      departmentNameSnapshot: techDept.name,
      approverId: zhangsan.id,
      approverNameSnapshot: zhangsan.name,
      leaveType: 'ANNUAL',
      startDate: new Date('2099-10-01'),
      endDate: new Date('2099-10-03'),
      days: 3,
      reason: '国庆假期出行',
      status: 'PENDING',
      stateVersion: 0,
    },
  });
  // Action log: SUBMITTED
  await prisma.leaveActionLog.upsert({
    where: {
      leaveRequestId_stateVersion: {
        leaveRequestId: leave1.id,
        stateVersion: 0,
      },
    },
    update: {},
    create: {
      leaveRequestId: leave1.id,
      action: 'SUBMITTED',
      operatorId: lisi.id,
      operatorNameSnapshot: lisi.name,
      comment: '提交请假申请',
      stateVersion: 0,
    },
  });
  console.log('[leave] PENDING — lisi annual leave (id:', leave1.id, ')');

  // 6b. APPROVED — zhangsan's leave approved by admin
  const leave2 = await prisma.leaveRequest.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      applicantId: zhangsan.id,
      applicantNameSnapshot: zhangsan.name,
      submittedDepartmentId: techDept.id,
      departmentNameSnapshot: techDept.name,
      approverId: admin.id,
      approverNameSnapshot: admin.name,
      leaveType: 'PERSONAL',
      startDate: new Date('2099-11-10'),
      endDate: new Date('2099-11-11'),
      days: 2,
      reason: '处理个人事务',
      status: 'APPROVED',
      stateVersion: 1,
    },
  });
  // Action log: SUBMITTED (v0)
  await prisma.leaveActionLog.upsert({
    where: {
      leaveRequestId_stateVersion: {
        leaveRequestId: leave2.id,
        stateVersion: 0,
      },
    },
    update: {},
    create: {
      leaveRequestId: leave2.id,
      action: 'SUBMITTED',
      operatorId: zhangsan.id,
      operatorNameSnapshot: zhangsan.name,
      comment: '提交请假申请',
      stateVersion: 0,
    },
  });
  // Action log: APPROVED (v1)
  await prisma.leaveActionLog.upsert({
    where: {
      leaveRequestId_stateVersion: {
        leaveRequestId: leave2.id,
        stateVersion: 1,
      },
    },
    update: {},
    create: {
      leaveRequestId: leave2.id,
      action: 'APPROVED',
      operatorId: admin.id,
      operatorNameSnapshot: admin.name,
      comment: '同意，请假期间注意工作交接。',
      stateVersion: 1,
    },
  });
  console.log('[leave] APPROVED — zhangsan personal leave (id:', leave2.id, ')');

  // 6c. REJECTED — wangwu's sick leave rejected by HR (no dept manager, use admin)
  const leave3 = await prisma.leaveRequest.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      applicantId: wangwu.id,
      applicantNameSnapshot: wangwu.name,
      submittedDepartmentId: hrDept.id,
      departmentNameSnapshot: hrDept.name,
      approverId: admin.id,
      approverNameSnapshot: admin.name,
      leaveType: 'SICK',
      startDate: new Date('2099-12-01'),
      endDate: new Date('2099-12-02'),
      days: 2,
      reason: '身体不适需就医',
      status: 'REJECTED',
      stateVersion: 1,
    },
  });
  // Action log: SUBMITTED (v0)
  await prisma.leaveActionLog.upsert({
    where: {
      leaveRequestId_stateVersion: {
        leaveRequestId: leave3.id,
        stateVersion: 0,
      },
    },
    update: {},
    create: {
      leaveRequestId: leave3.id,
      action: 'SUBMITTED',
      operatorId: wangwu.id,
      operatorNameSnapshot: wangwu.name,
      comment: '提交病假申请',
      stateVersion: 0,
    },
  });
  // Action log: REJECTED (v1)
  await prisma.leaveActionLog.upsert({
    where: {
      leaveRequestId_stateVersion: {
        leaveRequestId: leave3.id,
        stateVersion: 1,
      },
    },
    update: {},
    create: {
      leaveRequestId: leave3.id,
      action: 'REJECTED',
      operatorId: admin.id,
      operatorNameSnapshot: admin.name,
      comment: '请提供医院证明后再申请。',
      stateVersion: 1,
    },
  });
  console.log('[leave] REJECTED — wangwu sick leave (id:', leave3.id, ')');

  // ---------------------------------------------------------------------------
  // 7. Knowledge Categories (preset, idempotent)
  // ---------------------------------------------------------------------------
  const categories = [
    { name: '操作指南', description: '系统操作和工具使用指南', sortOrder: 1 },
    { name: '技术经验', description: '技术方案和开发经验分享', sortOrder: 2 },
    { name: '工作复盘', description: '项目和工作总结与反思', sortOrder: 3 },
    { name: '其他', description: '其他内部知识分享', sortOrder: 4 },
  ];

  for (const cat of categories) {
    const created = await prisma.knowledgeCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, sortOrder: cat.sortOrder, isActive: true },
      create: cat,
    });
    console.log('[knowledge_category]', created.name, '— id:', created.id);
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== Demo seeding completed successfully ===');
  console.log('Credentials (DEMO ONLY — change before any real use):');
  console.log('  admin    / admin123');
  console.log('  zhangsan / employee123');
  console.log('  lisi     / employee123');
  console.log('  wangwu   / employee123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
