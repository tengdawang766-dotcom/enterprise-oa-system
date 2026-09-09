import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import type { UpdateContactRequest } from './dto/me.dto';

export class MeService {
  /**
   * Get current user's full profile (used by GET /me).
   */
  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        mustChangePassword: true,
        departmentId: true,
        jobTitle: true,
        workEmail: true,
        phone: true,
        department: {
          select: {
            id: true,
            name: true,
            managerUserId: true,
          },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }

    const isDepartmentManager = user.department?.managerUserId === user.id;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      jobTitle: user.jobTitle,
      workEmail: user.workEmail,
      phone: user.phone,
      status: user.status,
      isDepartmentManager,
    };
  }

  /**
   * Update current user's contact info (workEmail, phone only).
   * Returns updated profile.
   */
  async updateContact(userId: number, dto: UpdateContactRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        workEmail: dto.workEmail,
        phone: dto.phone,
      },
    });

    return this.getProfile(userId);
  }

  /**
   * Get employee dashboard / work overview data.
   * Aggregates: unread announcements, recent announcements, leave stats,
   * recent leaves, and (for managers) pending approval tasks.
   */
  async getDashboard(userId: number) {
    // 1. Get user info with department
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
            managerUserId: true,
          },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }

    const isDepartmentManager = user.department?.managerUserId === user.id;

    // 2. Run all independent queries in parallel
    const [
      unreadAnnouncementCount,
      recentAnnouncements,
      myLeaveStats,
      recentLeaves,
      // Manager-only queries (will be empty for non-managers)
      pendingApprovalCount,
      recentPendingApprovals,
    ] = await Promise.all([
      // Unread: PUBLISHED announcements with no read record for current user
      prisma.announcement.count({
        where: {
          status: 'PUBLISHED',
          reads: { none: { userId } },
        },
      }),

      // Recent 5 published announcements with read status
      prisma.announcement.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          publishedAt: true,
          reads: {
            where: { userId },
            select: { firstReadAt: true },
            take: 1,
          },
        },
      }),

      // My leave stats: count by status
      prisma.leaveRequest.groupBy({
        by: ['status'],
        where: { applicantId: userId },
        _count: { id: true },
      }),

      // Recent 5 of my leaves
      prisma.leaveRequest.findMany({
        where: { applicantId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          createdAt: true,
        },
      }),

      // Pending approval count (manager only)
      isDepartmentManager
        ? prisma.leaveRequest.count({
            where: {
              approverId: userId,
              status: 'PENDING',
            },
          })
        : Promise.resolve(0),

      // Recent 5 pending approvals (manager only)
      isDepartmentManager
        ? prisma.leaveRequest.findMany({
            where: {
              approverId: userId,
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              applicantNameSnapshot: true,
              leaveType: true,
              startDate: true,
              endDate: true,
              days: true,
              reason: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // 3. Transform leave stats into a structured object
    const statsMap: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const row of myLeaveStats) {
      statsMap[row.status] = row._count.id;
    }

    // 4. Transform recent announcements to include read status
    const formattedAnnouncements = recentAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      publishedAt: a.publishedAt,
      read: a.reads.length > 0,
      firstReadAt: a.reads[0]?.firstReadAt || null,
    }));

    // 5. Format recent pending approvals (manager only)
    const formattedApprovals = recentPendingApprovals.map((a) => ({
      id: a.id,
      applicantName: a.applicantNameSnapshot,
      leaveType: a.leaveType,
      startDate: a.startDate,
      endDate: a.endDate,
      days: a.days,
      reason: a.reason,
      createdAt: a.createdAt,
    }));

    // 6. Build response
    return {
      user: {
        name: user.name,
        departmentName: user.department?.name || null,
        isDepartmentManager,
      },
      unreadAnnouncementCount,
      recentAnnouncements: formattedAnnouncements,
      myLeaveStats: {
        pending: statsMap.PENDING,
        approved: statsMap.APPROVED,
        rejected: statsMap.REJECTED,
        cancelled: statsMap.CANCELLED,
      },
      recentLeaves,
      ...(isDepartmentManager && {
        pendingApprovalCount,
        recentPendingApprovals: formattedApprovals,
      }),
    };
  }
}

export const meService = new MeService();
