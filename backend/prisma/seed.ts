import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
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

  console.log('Admin user created:', admin.username);

  // Create some departments
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

  console.log('Departments created:', techDept.name, hrDept.name);

  // Create some employees
  const emp1Password = await bcrypt.hash('employee123', 10);
  const emp1 = await prisma.user.upsert({
    where: { username: 'zhangsan' },
    update: {},
    create: {
      username: 'zhangsan',
      passwordHash: emp1Password,
      name: '张三',
      role: 'EMPLOYEE',
      departmentId: techDept.id,
      jobTitle: '前端工程师',
      workEmail: 'zhangsan@example.com',
      phone: '13800138001',
      mustChangePassword: true,
    },
  });

  const emp2 = await prisma.user.upsert({
    where: { username: 'lisi' },
    update: {},
    create: {
      username: 'lisi',
      passwordHash: emp1Password,
      name: '李四',
      role: 'EMPLOYEE',
      departmentId: techDept.id,
      jobTitle: '后端工程师',
      workEmail: 'lisi@example.com',
      phone: '13800138002',
      mustChangePassword: true,
    },
  });

  console.log('Employees created:', emp1.username, emp2.username);

  // Set tech department manager
  await prisma.department.update({
    where: { id: techDept.id },
    data: { managerUserId: emp1.id },
  });

  console.log('Tech department manager set to:', emp1.name);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
