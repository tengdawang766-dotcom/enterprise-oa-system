import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentQuery,
  SetManagerRequest,
  ManagerCandidateQuery,
} from './dto/department.dto';

export class DepartmentService {
  // ========================
  // CRUD
  // ========================

  async create(dto: CreateDepartmentRequest) {
    const existing = await prisma.department.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw BusinessException.conflict(
        ErrorCode.DEPARTMENT_NAME_ALREADY_EXISTS,
        '部门名称已存在'
      );
    }

    let dept;
    try {
      dept = await prisma.department.create({
        data: { name: dto.name },
        select: { id: true, name: true, managerUserId: true, createdAt: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw BusinessException.conflict(
          ErrorCode.DEPARTMENT_NAME_ALREADY_EXISTS,
          '部门名称已存在'
        );
      }
      throw e;
    }

    return {
      id: dept.id,
      name: dept.name,
      manager: null as { id: number; name: string } | null,
      createdAt: dept.createdAt,
    };
  }

  async findAll(query: DepartmentQuery) {
    const { page, pageSize, keyword } = query;
    const skip = (page - 1) * pageSize;

    const where = keyword
      ? { name: { contains: keyword } }
      : {};

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          manager: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.department.count({ where }),
    ]);

    const items = departments.map((d) => ({
      id: d.id,
      name: d.name,
      manager: d.manager ? { id: d.manager.id, name: d.manager.name } : null,
      createdAt: d.createdAt,
    }));

    return { items, total, page, pageSize };
  }

  async findById(id: number) {
    const dept = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        manager: {
          select: { id: true, name: true },
        },
      },
    });

    if (!dept) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
    }

    return {
      id: dept.id,
      name: dept.name,
      manager: dept.manager ? { id: dept.manager.id, name: dept.manager.name } : null,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    };
  }

  async update(id: number, dto: UpdateDepartmentRequest) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
    }

    if (dto.name !== dept.name) {
      const existing = await prisma.department.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw BusinessException.conflict(
          ErrorCode.DEPARTMENT_NAME_ALREADY_EXISTS,
          '部门名称已存在'
        );
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: { name: dto.name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        manager: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      manager: updated.manager ? { id: updated.manager.id, name: updated.manager.name } : null,
      createdAt: updated.createdAt,
    };
  }

  async remove(id: number) {
    const dept = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        managerUserId: true,
        _count: {
          select: {
            users: true,
            leaveRequests: true,
          },
        },
      },
    });

    if (!dept) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
    }

    // Check all deletion constraints
    const reasons: string[] = [];

    if (dept._count.users > 0) {
      reasons.push(`部门仍有 ${dept._count.users} 名员工`);
    }

    if (dept.managerUserId !== null) {
      reasons.push('部门仍有负责人，请先卸任');
    }

    if (dept._count.leaveRequests > 0) {
      reasons.push(`部门仍有 ${dept._count.leaveRequests} 条历史请假记录`);
    }

    if (reasons.length > 0) {
      throw BusinessException.conflict(
        ErrorCode.DEPARTMENT_NOT_EMPTY,
        `无法删除部门：${reasons.join('；')}`
      );
    }

    await prisma.department.delete({ where: { id } });
  }

  // ========================
  // Manager Management
  // ========================

  async getManagerCandidates(departmentId: number, query: ManagerCandidateQuery) {
    const { page, pageSize, keyword } = query;
    const skip = (page - 1) * pageSize;

    // Verify department exists
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
    }

    // Find users who are already managers (any department, including this one)
    const managedDepts = await prisma.department.findMany({
      where: {
        managerUserId: { not: null },
      },
      select: { managerUserId: true },
    });
    const managedUserIds = managedDepts
      .map((d) => d.managerUserId)
      .filter((id): id is number => id !== null);

    const where: any = {
      role: 'EMPLOYEE',
      status: 'ENABLED',
      departmentId,
      id: { notIn: managedUserIds },
    };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { username: { contains: keyword } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, jobTitle: true },
      }),
      prisma.user.count({ where }),
    ]);

    return { items: users, total, page, pageSize };
  }

  async setManager(departmentId: number, dto: SetManagerRequest) {
    return await prisma.$transaction(async (tx) => {
      // Lock the department row
      const deptRows = await tx.$queryRaw<
        Array<{ id: number; manager_user_id: number | null }>
      >`SELECT id, manager_user_id FROM departments WHERE id = ${departmentId} FOR UPDATE`;

      const dept = deptRows[0];
      if (!dept) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
      }

      const oldManagerId = dept.manager_user_id;
      const newManagerId = dto.userId;

      // If replacing, check old manager has no pending business
      if (oldManagerId !== null && oldManagerId !== newManagerId) {
        await this.checkManagerCanLeave(tx, oldManagerId);
      }

      // Validate new candidate
      await this.validateManagerCandidate(tx, newManagerId, departmentId);

      // Update
      await tx.department.update({
        where: { id: departmentId },
        data: { managerUserId: newManagerId },
      });

      return { departmentId, managerUserId: newManagerId };
    });
  }

  async removeManager(departmentId: number) {
    return await prisma.$transaction(async (tx) => {
      // Lock the department row
      const deptRows = await tx.$queryRaw<
        Array<{ id: number; manager_user_id: number | null }>
      >`SELECT id, manager_user_id FROM departments WHERE id = ${departmentId} FOR UPDATE`;

      const dept = deptRows[0];
      if (!dept) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '部门不存在');
      }

      if (dept.manager_user_id === null) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '该部门当前没有负责人');
      }

      // Check old manager has no pending business
      await this.checkManagerCanLeave(tx, dept.manager_user_id);

      await tx.department.update({
        where: { id: departmentId },
        data: { managerUserId: null },
      });

      return { departmentId, managerUserId: null };
    });
  }

  // ---- Internal helpers ----

  private async checkManagerCanLeave(tx: any, userId: number) {
    // Check pending leave requests as applicant
    const pendingLeave = await tx.leaveRequest.findFirst({
      where: { applicantId: userId, status: 'PENDING' },
      select: { id: true },
    });

    if (pendingLeave) {
      throw BusinessException.conflict(
        ErrorCode.MANAGER_HAS_PENDING_LEAVE,
        '该负责人有待审批的请假申请，请先处理后再操作'
      );
    }

    // Check pending approval tasks
    const pendingApproval = await tx.leaveRequest.findFirst({
      where: { approverId: userId, status: 'PENDING' },
      select: { id: true },
    });

    if (pendingApproval) {
      throw BusinessException.conflict(
        ErrorCode.MANAGER_HAS_PENDING_APPROVAL_TASKS,
        '该负责人有未处理的审批任务，请先处理后再操作'
      );
    }
  }

  private async validateManagerCandidate(tx: any, userId: number, departmentId: number) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, departmentId: true },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    if (user.role !== 'EMPLOYEE') {
      throw BusinessException.badRequest(
        ErrorCode.INVALID_MANAGER_CANDIDATE,
        '负责人必须是普通员工'
      );
    }

    if (user.status !== 'ENABLED') {
      throw BusinessException.badRequest(
        ErrorCode.INVALID_MANAGER_CANDIDATE,
        '负责人账号必须处于启用状态'
      );
    }

    if (user.departmentId !== departmentId) {
      throw BusinessException.badRequest(
        ErrorCode.INVALID_MANAGER_CANDIDATE,
        '负责人必须属于目标部门'
      );
    }

    // Check if already managing another department
    const otherDept = await tx.department.findFirst({
      where: {
        managerUserId: userId,
        id: { not: departmentId },
      },
      select: { id: true, name: true },
    });

    if (otherDept) {
      throw BusinessException.conflict(
        ErrorCode.INVALID_MANAGER_CANDIDATE,
        `该员工已是「${otherDept.name}」的负责人，不能同时负责多个部门`
      );
    }
  }
}

export const departmentService = new DepartmentService();
