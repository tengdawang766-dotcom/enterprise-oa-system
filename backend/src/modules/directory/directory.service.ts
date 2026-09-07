import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { DirectoryQuery } from './dto/directory.dto';

export class DirectoryService {
  async findAll(query: DirectoryQuery) {
    const { page, pageSize, keyword, departmentId } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      role: 'EMPLOYEE',
      status: 'ENABLED',
    };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { username: { contains: keyword } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          username: true,
          jobTitle: true,
          workEmail: true,
          phone: true,
          department: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      department: u.department ? { id: u.department.id, name: u.department.name } : null,
      jobTitle: u.jobTitle,
      workEmail: u.workEmail,
      phone: u.phone,
    }));

    return { items, total, page, pageSize };
  }

  async findById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        jobTitle: true,
        workEmail: true,
        phone: true,
        department: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '员工不存在');
    }

    // Only show ENABLED employees in directory
    if (user.role !== 'EMPLOYEE' || user.status !== 'ENABLED') {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '员工不存在');
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      jobTitle: user.jobTitle,
      workEmail: user.workEmail,
      phone: user.phone,
    };
  }

  async getDepartments() {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return departments;
  }
}

export const directoryService = new DirectoryService();
