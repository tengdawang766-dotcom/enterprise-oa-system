import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { formatDateOnly, formatTimestamp } from '../../common/utils/date-format';
import {
  CreateLeaveRequest,
  EditLeaveRequest,
  MyLeaveQuery,
  ApprovalTasksQuery,
  ApprovalHistoryQuery,
} from './dto/leave.dto';

export class LeaveService {
  // ============================================================
  // Helper: compute natural days (inclusive)
  // ============================================================
  private computeDays(startDate: string, endDate: string): number {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  // ============================================================
  // Helper: get today in Beijing time (YYYY-MM-DD)
  // ============================================================
  private getTodayBeijing(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const beijing = new Date(utc + 8 * 3600000);
    const y = beijing.getFullYear();
    const m = String(beijing.getMonth() + 1).padStart(2, '0');
    const d = String(beijing.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ============================================================
  // Helper: format leave request for response
  // ============================================================
  private formatLeaveRequest(lr: any) {
    return {
      id: lr.id,
      leaveType: lr.leaveType,
      startDate: formatDateOnly(lr.startDate),
      endDate: formatDateOnly(lr.endDate),
      days: lr.days,
      reason: lr.reason,
      status: lr.status,
      stateVersion: lr.stateVersion,
      applicant: lr.applicant
        ? { id: lr.applicant.id, name: lr.applicant.name }
        : undefined,
      submittedDepartment: lr.submittedDepartment
        ? { id: lr.submittedDepartment.id, name: lr.submittedDepartment.name }
        : undefined,
      approver: lr.approver
        ? { id: lr.approver.id, name: lr.approver.name }
        : undefined,
      createdAt: formatTimestamp(lr.createdAt),
      updatedAt: formatTimestamp(lr.updatedAt),
      actionLogs: lr.actionLogs
        ? lr.actionLogs.map((log: any) => ({
            id: log.id,
            action: log.action,
            operatorId: log.operatorId,
            operatorName: log.operatorNameSnapshot,
            comment: log.comment,
            stateVersion: log.stateVersion,
            createdAt: formatTimestamp(log.createdAt),
          }))
        : undefined,
      finalAction: lr.finalAction
        ? {
            action: lr.finalAction.action,
            operatorName: lr.finalAction.operatorNameSnapshot,
            comment: lr.finalAction.comment,
            createdAt: lr.finalAction.createdAt?.toISOString?.() ?? lr.finalAction.createdAt,
          }
        : undefined,
    };
  }

  // ============================================================
  // Create + Submit
  // ============================================================
  async create(applicantId: number, dto: CreateLeaveRequest) {
    // 1. Get applicant
    const applicant = await prisma.user.findUnique({
      where: { id: applicantId },
      select: { id: true, name: true, departmentId: true, role: true, status: true },
    });

    if (!applicant || applicant.status === 'DISABLED') {
      throw BusinessException.forbidden(ErrorCode.FORBIDDEN, '用户无效');
    }

    if (!applicant.departmentId) {
      throw BusinessException.conflict(ErrorCode.LEAVE_NO_DEPARTMENT, '员工没有所属部门，无法提交请假');
    }

    // 2. Get department
    const department = await prisma.department.findUnique({
      where: { id: applicant.departmentId },
      select: { id: true, name: true, managerUserId: true },
    });

    if (!department) {
      throw BusinessException.conflict(ErrorCode.LEAVE_NO_DEPARTMENT, '部门不存在');
    }

    if (!department.managerUserId) {
      throw BusinessException.conflict(ErrorCode.LEAVE_DEPARTMENT_NO_MANAGER, '部门没有负责人，无法审批请假');
    }

    // 3. Check if manager is self (department manager submitting)
    const isManagerSelf = department.managerUserId === applicantId;

    let approverId: number;
    let approverName: string;

    if (isManagerSelf) {
      // Manager submitting own leave - reject per Day 4 spec
      throw BusinessException.conflict(
        ErrorCode.LEAVE_SELF_APPROVAL_NOT_ALLOWED,
        '部门负责人本人请假暂不支持，请联系上级处理'
      );
    } else {
      // Normal employee - auto-assign department manager
      const approver = await prisma.user.findUnique({
        where: { id: department.managerUserId },
        select: { id: true, name: true, status: true },
      });

      if (!approver || approver.status === 'DISABLED') {
        throw BusinessException.conflict(ErrorCode.LEAVE_APPROVER_NOT_AVAILABLE, '审批人不可用');
      }

      approverId = approver.id;
      approverName = approver.name;
    }

    // 4. Validate dates
    const today = this.getTodayBeijing();
    if (dto.startDate < today) {
      throw BusinessException.badRequest(ErrorCode.LEAVE_DATE_BEFORE_TODAY, '开始日期不能早于今天');
    }
    if (dto.endDate < dto.startDate) {
      throw BusinessException.badRequest(ErrorCode.LEAVE_DATE_INVALID, '结束日期不能早于开始日期');
    }

    // 5. Compute days
    const days = this.computeDays(dto.startDate, dto.endDate);
    if (days < 1 || days > 30) {
      throw BusinessException.badRequest(ErrorCode.LEAVE_DURATION_EXCEEDED, '请假天数必须在1-30天之间');
    }

    // 6. Check date overlap with existing PENDING/APPROVED
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        applicantId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: new Date(dto.endDate + 'T00:00:00Z') },
        endDate: { gte: new Date(dto.startDate + 'T00:00:00Z') },
      },
      select: { id: true },
    });

    if (overlap) {
      throw BusinessException.conflict(ErrorCode.LEAVE_DATE_OVERLAP, '该日期范围与已有请假申请重叠');
    }

    // 7. Create in transaction with SUBMITTED log
    const result = await prisma.$transaction(async (tx) => {
      const leaveRequest = await tx.leaveRequest.create({
        data: {
          applicantId,
          applicantNameSnapshot: applicant.name,
          submittedDepartmentId: department.id,
          departmentNameSnapshot: department.name,
          approverId,
          approverNameSnapshot: approverName,
          leaveType: dto.leaveType,
          startDate: new Date(dto.startDate + 'T00:00:00Z'),
          endDate: new Date(dto.endDate + 'T00:00:00Z'),
          days,
          reason: dto.reason,
          status: 'PENDING',
          stateVersion: 0,
        },
        select: { id: true },
      });

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: leaveRequest.id,
          action: 'SUBMITTED',
          operatorId: applicantId,
          operatorNameSnapshot: applicant.name,
          comment: null,
          stateVersion: 0,
        },
      });

      return leaveRequest.id;
    });

    return this.findById(result);
  }

  // ============================================================
  // My Leave List
  // ============================================================
  async findMyLeaves(applicantId: number, query: MyLeaveQuery) {
    const where: Prisma.LeaveRequestWhereInput = {
      applicantId,
      ...(query.status && { status: query.status }),
      ...(query.leaveType && { leaveType: query.leaveType }),
      ...(query.startDateFrom || query.startDateTo
        ? {
            startDate: {
              ...(query.startDateFrom && { gte: new Date(query.startDateFrom + 'T00:00:00Z') }),
              ...(query.startDateTo && { lte: new Date(query.startDateTo + 'T00:00:00Z') }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          days: true,
          reason: true,
          status: true,
          stateVersion: true,
          createdAt: true,
          updatedAt: true,
          applicantId: true,
          approverId: true,
          approverNameSnapshot: true,
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items: items.map((lr) => this.formatLeaveRequest({
        ...lr,
        approver: { id: lr.approverId, name: lr.approverNameSnapshot },
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ============================================================
  // My Leave Detail
  // ============================================================
  async findMyLeaveById(id: number, applicantId: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, name: true } },
        submittedDepartment: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        actionLogs: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            action: true,
            operatorId: true,
            operatorNameSnapshot: true,
            comment: true,
            stateVersion: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.applicantId !== applicantId) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    // Get final action log
    const finalLog = lr.actionLogs.length > 0 ? lr.actionLogs[lr.actionLogs.length - 1] : null;

    return this.formatLeaveRequest({
      ...lr,
      finalAction: finalLog,
    });
  }

  // ============================================================
  // Cancel
  // ============================================================
  async cancel(id: number, userId: number, expectedStateVersion: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, applicantId: true, status: true, stateVersion: true },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.applicantId !== userId) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.status !== 'PENDING') {
      throw BusinessException.conflict(ErrorCode.LEAVE_STATE_NOT_ALLOWED, '只有待审批的申请才能撤回');
    }

    // Conditional update for concurrency
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING', stateVersion: expectedStateVersion },
        data: { status: 'CANCELLED', stateVersion: expectedStateVersion + 1 },
      });

      if (updated.count === 0) {
        throw BusinessException.conflict(ErrorCode.LEAVE_STATE_CONFLICT, '申请状态已变化，请刷新后重试');
      }

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: id,
          action: 'CANCELLED',
          operatorId: userId,
          operatorNameSnapshot: user!.name,
          comment: null,
          stateVersion: expectedStateVersion + 1,
        },
      });

      return id;
    });

    return this.findById(result);
  }

  // ============================================================
  // Edit (cancelled only)
  // ============================================================
  async edit(id: number, userId: number, dto: EditLeaveRequest) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: {
        id: true, applicantId: true, status: true, stateVersion: true,
        leaveType: true, startDate: true, endDate: true, reason: true,
      },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.applicantId !== userId) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.status !== 'CANCELLED') {
      throw BusinessException.conflict(ErrorCode.LEAVE_STATE_NOT_ALLOWED, '只有已撤回的申请才能修改');
    }

    // Compute new values
    const newLeaveType = dto.leaveType ?? lr.leaveType;
    const newStartDate = dto.startDate ?? (lr.startDate instanceof Date ? lr.startDate.toISOString().split('T')[0] : lr.startDate);
    const newEndDate = dto.endDate ?? (lr.endDate instanceof Date ? lr.endDate.toISOString().split('T')[0] : lr.endDate);
    const newReason = dto.reason ?? lr.reason;

    // Validate dates if changed
    if (dto.startDate || dto.endDate) {
      const today = this.getTodayBeijing();
      if (newStartDate < today) {
        throw BusinessException.badRequest(ErrorCode.LEAVE_DATE_BEFORE_TODAY, '开始日期不能早于今天');
      }
      if (newEndDate < newStartDate) {
        throw BusinessException.badRequest(ErrorCode.LEAVE_DATE_INVALID, '结束日期不能早于开始日期');
      }
    }

    const newDays = this.computeDays(newStartDate, newEndDate);
    if (newDays < 1 || newDays > 30) {
      throw BusinessException.badRequest(ErrorCode.LEAVE_DURATION_EXCEEDED, '请假天数必须在1-30天之间');
    }

    // Check date overlap (excluding this request)
    if (dto.startDate || dto.endDate) {
      const overlap = await prisma.leaveRequest.findFirst({
        where: {
          applicantId: userId,
          id: { not: id },
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: new Date(newEndDate + 'T00:00:00Z') },
          endDate: { gte: new Date(newStartDate + 'T00:00:00Z') },
        },
        select: { id: true },
      });

      if (overlap) {
        throw BusinessException.conflict(ErrorCode.LEAVE_DATE_OVERLAP, '该日期范围与已有请假申请重叠');
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const result = await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          leaveType: newLeaveType,
          startDate: new Date(newStartDate + 'T00:00:00Z'),
          endDate: new Date(newEndDate + 'T00:00:00Z'),
          days: newDays,
          reason: newReason,
        },
      });

      // Log the edit action
      const newVersion = lr.stateVersion + 1;
      await tx.leaveRequest.update({
        where: { id },
        data: { stateVersion: newVersion },
      });

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: id,
          action: 'EDITED',
          operatorId: userId,
          operatorNameSnapshot: user!.name,
          comment: null,
          stateVersion: newVersion,
        },
      });

      return id;
    });

    return this.findById(result);
  }

  // ============================================================
  // Resubmit (cancelled -> pending)
  // ============================================================
  async resubmit(id: number, userId: number, expectedStateVersion: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: {
        id: true, applicantId: true, status: true, stateVersion: true,
        submittedDepartmentId: true,
      },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.applicantId !== userId) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.status !== 'CANCELLED') {
      throw BusinessException.conflict(ErrorCode.LEAVE_STATE_NOT_ALLOWED, '只有已撤回的申请才能重新提交');
    }

    // Re-determine approver
    const department = await prisma.department.findUnique({
      where: { id: lr.submittedDepartmentId },
      select: { id: true, managerUserId: true },
    });

    if (!department || !department.managerUserId) {
      throw BusinessException.conflict(ErrorCode.LEAVE_DEPARTMENT_NO_MANAGER, '部门没有负责人，无法重新提交');
    }

    if (department.managerUserId === userId) {
      throw BusinessException.conflict(ErrorCode.LEAVE_SELF_APPROVAL_NOT_ALLOWED, '部门负责人本人请假暂不支持');
    }

    const approver = await prisma.user.findUnique({
      where: { id: department.managerUserId },
      select: { id: true, name: true, status: true },
    });

    if (!approver || approver.status === 'DISABLED') {
      throw BusinessException.conflict(ErrorCode.LEAVE_APPROVER_NOT_AVAILABLE, '审批人不可用');
    }

    // Check date overlap
    const fullLr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    });

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        applicantId: userId,
        id: { not: id },
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: fullLr!.endDate },
        endDate: { gte: fullLr!.startDate },
      },
      select: { id: true },
    });

    if (overlap) {
      throw BusinessException.conflict(ErrorCode.LEAVE_DATE_OVERLAP, '该日期范围与已有请假申请重叠');
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.updateMany({
        where: { id, status: 'CANCELLED', stateVersion: expectedStateVersion },
        data: {
          status: 'PENDING',
          stateVersion: expectedStateVersion + 1,
          approverId: approver.id,
          approverNameSnapshot: approver.name,
        },
      });

      if (updated.count === 0) {
        throw BusinessException.conflict(ErrorCode.LEAVE_STATE_CONFLICT, '申请状态已变化，请刷新后重试');
      }

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: id,
          action: 'RESUBMITTED',
          operatorId: userId,
          operatorNameSnapshot: user!.name,
          comment: null,
          stateVersion: expectedStateVersion + 1,
        },
      });

      return id;
    });

    return this.findById(result);
  }

  // ============================================================
  // Approval Tasks (pending for current manager)
  // ============================================================
  async findApprovalTasks(approverId: number, query: ApprovalTasksQuery) {
    const where: Prisma.LeaveRequestWhereInput = {
      approverId,
      status: 'PENDING',
      ...(query.keyword
        ? {
            applicantNameSnapshot: { contains: query.keyword },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          applicant: { select: { id: true, name: true } },
          submittedDepartment: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items: items.map((lr) => this.formatLeaveRequest(lr)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ============================================================
  // Approval History (processed by current user)
  // ============================================================
  async findApprovalHistory(approverId: number, query: ApprovalHistoryQuery) {
    const where: Prisma.LeaveRequestWhereInput = {
      approverId,
      status: { in: ['APPROVED', 'REJECTED'] },
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          applicant: { select: { id: true, name: true } },
          submittedDepartment: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
          actionLogs: {
            where: { action: { in: ['APPROVED', 'REJECTED'] } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items: items.map((lr) => {
        const formatted = this.formatLeaveRequest(lr);
        if (lr.actionLogs.length > 0) {
          formatted.finalAction = {
            action: lr.actionLogs[0].action,
            operatorName: lr.actionLogs[0].operatorNameSnapshot,
            comment: lr.actionLogs[0].comment,
            createdAt: lr.actionLogs[0].createdAt?.toISOString?.() ?? lr.actionLogs[0].createdAt,
          };
        }
        return formatted;
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ============================================================
  // Approval Detail
  // ============================================================
  async findApprovalDetail(id: number, approverId: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, name: true } },
        submittedDepartment: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        actionLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    // Only the designated approver can view
    if (lr.approverId !== approverId) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    const finalLog = lr.actionLogs.length > 0 ? lr.actionLogs[lr.actionLogs.length - 1] : null;

    return this.formatLeaveRequest({
      ...lr,
      finalAction: finalLog,
    });
  }

  // ============================================================
  // Approve
  // ============================================================
  async approve(id: number, approverId: number, comment: string | null | undefined, expectedStateVersion: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, approverId: true, status: true, stateVersion: true },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.approverId !== approverId) {
      throw BusinessException.forbidden(ErrorCode.APPROVAL_NOT_ASSIGNED, '您不是该申请的审批人');
    }

    if (lr.status !== 'PENDING') {
      throw BusinessException.conflict(ErrorCode.LEAVE_STATE_NOT_ALLOWED, '该申请已处理，不能重复审批');
    }

    const user = await prisma.user.findUnique({ where: { id: approverId }, select: { name: true } });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.updateMany({
        where: { id, approverId, status: 'PENDING', stateVersion: expectedStateVersion },
        data: { status: 'APPROVED', stateVersion: expectedStateVersion + 1 },
      });

      if (updated.count === 0) {
        throw BusinessException.conflict(ErrorCode.LEAVE_STATE_CONFLICT, '申请状态已变化，请刷新后重试');
      }

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: id,
          action: 'APPROVED',
          operatorId: approverId,
          operatorNameSnapshot: user!.name,
          comment: comment || null,
          stateVersion: expectedStateVersion + 1,
        },
      });

      return id;
    });

    return this.findById(result);
  }

  // ============================================================
  // Reject
  // ============================================================
  async reject(id: number, approverId: number, reason: string, expectedStateVersion: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, approverId: true, status: true, stateVersion: true },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    if (lr.approverId !== approverId) {
      throw BusinessException.forbidden(ErrorCode.APPROVAL_NOT_ASSIGNED, '您不是该申请的审批人');
    }

    if (lr.status !== 'PENDING') {
      throw BusinessException.conflict(ErrorCode.LEAVE_STATE_NOT_ALLOWED, '该申请已处理，不能重复审批');
    }

    const user = await prisma.user.findUnique({ where: { id: approverId }, select: { name: true } });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.updateMany({
        where: { id, approverId, status: 'PENDING', stateVersion: expectedStateVersion },
        data: { status: 'REJECTED', stateVersion: expectedStateVersion + 1 },
      });

      if (updated.count === 0) {
        throw BusinessException.conflict(ErrorCode.LEAVE_STATE_CONFLICT, '申请状态已变化，请刷新后重试');
      }

      await tx.leaveActionLog.create({
        data: {
          leaveRequestId: id,
          action: 'REJECTED',
          operatorId: approverId,
          operatorNameSnapshot: user!.name,
          comment: reason,
          stateVersion: expectedStateVersion + 1,
        },
      });

      return id;
    });

    return this.findById(result);
  }

  // ============================================================
  // Helpers
  // ============================================================
  private async findById(id: number) {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, name: true } },
        submittedDepartment: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        actionLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!lr) {
      throw BusinessException.notFound(ErrorCode.LEAVE_NOT_FOUND, '请假申请不存在');
    }

    const finalLog = lr.actionLogs.length > 0 ? lr.actionLogs[lr.actionLogs.length - 1] : null;

    return this.formatLeaveRequest({
      ...lr,
      finalAction: finalLog,
    });
  }
}

export const leaveService = new LeaveService();
