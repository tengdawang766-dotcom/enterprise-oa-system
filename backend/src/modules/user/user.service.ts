import bcrypt from 'bcryptjs';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import {
  CreateUserRequest,
  UpdateUserRequest,
  TransferDepartmentRequest,
  ResetPasswordRequest,
  UserQuery,
} from './dto/user.dto';

// Common select for user list/detail (no sensitive fields)
const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  departmentId: true,
  jobTitle: true,
  workEmail: true,
  phone: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: { id: true, name: true, managerUserId: true },
  },
} as const;

function toUserResponse(user: any) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department
      ? { id: user.department.id, name: user.department.name }
      : null,
    jobTitle: user.jobTitle,
    workEmail: user.workEmail,
    phone: user.phone,
    status: user.status,
    isDepartmentManager: user.department?.managerUserId === user.id,
    createdAt: user.createdAt,
  };
}

export class UserService {
  async create(dto: CreateUserRequest) {
    // Check username uniqueness
    const existing = await prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw BusinessException.conflict(
        ErrorCode.USERNAME_ALREADY_EXISTS,
        '账号已存在'
      );
    }

    // Verify department exists if provided
    if (dto.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw BusinessException.badRequest(
          ErrorCode.VALIDATION_ERROR,
          '指定的部门不存在'
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.initialPassword, 10);

    const user = await prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        role: dto.role,
        departmentId: dto.role === 'ADMIN' ? null : dto.departmentId!,
        jobTitle: dto.jobTitle ?? null,
        workEmail: dto.workEmail ?? null,
        phone: dto.phone ?? null,
        status: 'ENABLED',
        mustChangePassword: true,
      },
      select: userSelect,
    });

    return toUserResponse(user);
  }

  async findAll(query: UserQuery) {
    const { page, pageSize, keyword, role, status, departmentId, managerDuty, sortBy, sortOrder } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }

    if (role) where.role = role;
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;

    // managerDuty: filter by whether user is a department manager
    if (managerDuty === 'true') {
      where.department = { managerUserId: { not: null } };
      // This alone doesn't guarantee "this user is the manager"
      // We'll use a different approach: filter managed departments
      const managedDepts = await prisma.department.findMany({
        where: { managerUserId: { not: null } },
        select: { managerUserId: true },
      });
      const managerIds = managedDepts
        .map((d) => d.managerUserId)
        .filter((id): id is number => id !== null);
      where.id = { in: managerIds };
      delete where.department;
    } else if (managerDuty === 'false') {
      const managedDepts = await prisma.department.findMany({
        where: { managerUserId: { not: null } },
        select: { managerUserId: true },
      });
      const managerIds = managedDepts
        .map((d) => d.managerUserId)
        .filter((id): id is number => id !== null);
      where.id = { notIn: managerIds };
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        select: userSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map(toUserResponse),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    return toUserResponse(user);
  }

  async update(id: number, dto: UpdateUserRequest) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle;
    if (dto.workEmail !== undefined) data.workEmail = dto.workEmail;
    if (dto.phone !== undefined) data.phone = dto.phone;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return toUserResponse(updated);
  }

  async transferDepartment(userId: number, dto: TransferDepartmentRequest) {
    return await prisma.$transaction(async (tx) => {
      // Lock user row
      const userRows = await tx.$queryRaw<
        Array<{ id: number; role: string; department_id: number | null }>
      >`SELECT id, role, department_id FROM users WHERE id = ${userId} FOR UPDATE`;

      const user = userRows[0];
      if (!user) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
      }

      if (user.role !== 'EMPLOYEE') {
        throw BusinessException.badRequest(
          ErrorCode.VALIDATION_ERROR,
          '只能调动员工的部门，管理员没有部门'
        );
      }

      // Check target department exists
      const dept = await tx.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw BusinessException.badRequest(
          ErrorCode.VALIDATION_ERROR,
          '目标部门不存在'
        );
      }

      // Check if user is current manager of their department
      if (user.department_id !== null) {
        const managedDept = await tx.department.findFirst({
          where: {
            managerUserId: userId,
            id: user.department_id,
          },
          select: { id: true, name: true },
        });

        if (managedDept) {
          throw BusinessException.conflict(
            ErrorCode.USER_IS_CURRENT_MANAGER,
            `该员工是「${managedDept.name}」的负责人，请先更换或卸任负责人后再调动`
          );
        }
      }

      // Check no pending leave requests
      const pendingLeave = await tx.leaveRequest.findFirst({
        where: { applicantId: userId, status: 'PENDING' },
        select: { id: true },
      });

      if (pendingLeave) {
        throw BusinessException.conflict(
          ErrorCode.USER_PENDING_LEAVE_EXISTS,
          '该员工有待审批的请假申请，请先处理后再调动'
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: { departmentId: dto.departmentId },
      });

      return { userId, departmentId: dto.departmentId };
    });
  }

  async resetPassword(userId: number, dto: ResetPasswordRequest) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!user) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
      }

      const newHash = await bcrypt.hash(dto.newPassword, 10);

      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: true,
          tokenVersion: { increment: 1 },
        },
      });

      return { message: '密码重置成功，用户需使用新密码重新登录' };
    });
  }

  async disable(currentUserId: number, userId: number) {
    return await prisma.$transaction(async (tx) => {
      // Cannot disable self
      if (currentUserId === userId) {
        throw BusinessException.conflict(
          ErrorCode.ADMIN_CANNOT_DISABLE_SELF,
          '管理员不能停用自己的账号'
        );
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
      });

      if (!user) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
      }

      // Check if current manager
      const managedDept = await tx.department.findFirst({
        where: { managerUserId: userId },
        select: { id: true, name: true },
      });

      if (managedDept) {
        throw BusinessException.conflict(
          ErrorCode.MANAGER_MUST_BE_REMOVED_BEFORE_DISABLE,
          `该员工是「${managedDept.name}」的负责人，请先更换或卸任负责人后再停用`
        );
      }

      // Check pending leave
      const pendingLeave = await tx.leaveRequest.findFirst({
        where: { applicantId: userId, status: 'PENDING' },
        select: { id: true },
      });

      if (pendingLeave) {
        throw BusinessException.conflict(
          ErrorCode.USER_PENDING_LEAVE_EXISTS,
          '该员工有待审批的请假申请，请先处理后再停用'
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DISABLED',
          tokenVersion: { increment: 1 },
        },
      });

      return { message: '账号已停用' };
    });
  }
}

export const userService = new UserService();
