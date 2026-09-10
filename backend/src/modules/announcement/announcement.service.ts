import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import {
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  AdminAnnouncementQuery,
  EmployeeAnnouncementQuery,
  ReadListQuery,
} from './dto/announcement.dto';

export class AnnouncementService {
  // ========================
  // Admin: Create Draft
  // ========================
  async create(publisherId: number, dto: CreateAnnouncementRequest) {
    const announcement = await prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        publisherId,
        status: 'DRAFT',
      },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publisherId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatAnnouncement(announcement);
  }

  // ========================
  // Admin: Update Draft
  // ========================
  async update(id: number, dto: UpdateAnnouncementRequest) {
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
    }

    if (existing.status !== 'DRAFT') {
      throw BusinessException.conflict(
        ErrorCode.ANNOUNCEMENT_STATE_NOT_EDITABLE,
        '只有草稿状态的公告才能编辑'
      );
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: { title: dto.title, content: dto.content },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publisherId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatAnnouncement(updated);
  }

  // ========================
  // Admin: Delete Draft
  // ========================
  async remove(id: number) {
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
    }

    if (existing.status !== 'DRAFT') {
      throw BusinessException.conflict(
        ErrorCode.ANNOUNCEMENT_STATE_NOT_DELETABLE,
        '只有草稿状态的公告才能删除'
      );
    }

    await prisma.announcement.delete({ where: { id } });
  }

  // ========================
  // Admin: Publish
  // ========================
  async publish(id: number) {
    const result = await prisma.announcement.updateMany({
      where: { id, status: 'DRAFT' },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await prisma.announcement.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
      }

      if (existing.status === 'PUBLISHED') {
        throw BusinessException.conflict(ErrorCode.ANNOUNCEMENT_ALREADY_PUBLISHED, '公告已经发布');
      }

      throw BusinessException.conflict(ErrorCode.ANNOUNCEMENT_NOT_PUBLISHED, '只有草稿状态的公告才能发布');
    }

    const published = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publisherId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatAnnouncement(published!);
  }

  // ========================
  // Admin: Withdraw
  // ========================
  async withdraw(id: number) {
    const result = await prisma.announcement.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await prisma.announcement.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
      }

      if (existing.status === 'WITHDRAWN') {
        throw BusinessException.conflict(ErrorCode.ANNOUNCEMENT_ALREADY_WITHDRAWN, '公告已经撤回');
      }

      throw BusinessException.conflict(ErrorCode.ANNOUNCEMENT_NOT_PUBLISHED, '只有已发布的公告才能撤回');
    }

    const withdrawn = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publisherId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatAnnouncement(withdrawn!);
  }

  // ========================
  // Admin: Announcement List
  // ========================
  async findAdminAll(query: AdminAnnouncementQuery) {
    const { page, pageSize, status, keyword } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (keyword) {
      where.title = { contains: keyword };
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          status: true,
          publisherId: true,
          publishedAt: true,
          withdrawnAt: true,
          createdAt: true,
          updatedAt: true,
          publisher: { select: { name: true } },
          _count: { select: { reads: true } },
        },
      }),
      prisma.announcement.count({ where }),
    ]);

    // Get total employee count (ENABLED, role=EMPLOYEE) for read rate calculation
    const totalEmployees = await prisma.user.count({
      where: { role: 'EMPLOYEE', status: 'ENABLED' },
    });

    const items = announcements.map((a) => ({
      ...this.formatAnnouncement(a),
      publisherName: a.publisher.name,
      readCount: a._count.reads,
      totalEmployees,
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Admin: Announcement Detail
  // ========================
  async findAdminById(id: number) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publisherId: true,
        publishedAt: true,
        withdrawnAt: true,
        createdAt: true,
        updatedAt: true,
        publisher: { select: { id: true, name: true } },
      },
    });

    if (!announcement) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
    }

    return {
      ...this.formatAnnouncement(announcement),
      publisher: { id: announcement.publisher.id, name: announcement.publisher.name },
    };
  }

  // ========================
  // Employee: Announcement List (PUBLISHED only)
  // ========================
  async findEmployeeAll(userId: number, query: EmployeeAnnouncementQuery) {
    const { page, pageSize, keyword, readStatus } = query;
    const skip = (page - 1) * pageSize;

    const where: any = { status: 'PUBLISHED' };
    if (keyword) {
      where.title = { contains: keyword };
    }

    // Apply readStatus filter at the database level
    if (readStatus === 'READ') {
      where.reads = { some: { userId } };
    } else if (readStatus === 'UNREAD') {
      where.reads = { none: { userId } };
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
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
      prisma.announcement.count({ where }),
    ]);

    const items = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      publishedAt: a.publishedAt,
      read: a.reads.length > 0,
      firstReadAt: a.reads.length > 0 ? a.reads[0].firstReadAt : null,
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Employee: Open Announcement (record read)
  // ========================
  async openAnnouncement(userId: number, announcementId: number) {
    // Verify announcement exists and is PUBLISHED
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        publishedAt: true,
      },
    });

    if (!announcement) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
    }

    if (announcement.status !== 'PUBLISHED') {
      throw BusinessException.conflict(
        ErrorCode.ANNOUNCEMENT_NOT_AVAILABLE,
        '该公告当前不可查看'
      );
    }

    // Upsert read record - use raw SQL for ON DUPLICATE KEY behavior
    // to ensure first_read_at is never overwritten
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO announcement_reads (announcement_id, user_id, first_read_at)
      VALUES (${announcementId}, ${userId}, ${now})
      ON DUPLICATE KEY UPDATE first_read_at = first_read_at
    `;

    // Get the read record
    const readRecord = await prisma.announcementRead.findUnique({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      select: { firstReadAt: true },
    });

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      publishedAt: announcement.publishedAt,
      read: true,
      firstReadAt: readRecord?.firstReadAt ?? null,
    };
  }

  // ========================
  // Admin: Read Statistics
  // ========================
  async getReadStats(announcementId: number) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, status: true },
    });

    if (!announcement) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '公告不存在');
    }

    // Count total enabled employees
    const totalEmployees = await prisma.user.count({
      where: { role: 'EMPLOYEE', status: 'ENABLED' },
    });

    // Count who read this announcement (only current enabled employees)
    const readCount = await prisma.announcementRead.count({
      where: {
        announcementId,
        user: { role: 'EMPLOYEE', status: 'ENABLED' },
      },
    });

    return {
      announcementId,
      totalEmployees,
      readCount,
      unreadCount: Math.max(0, totalEmployees - readCount),
      readRate: totalEmployees > 0 ? Math.min(100, Math.round((readCount / totalEmployees) * 100)) : 0,
    };
  }

  // ========================
  // Admin: Read List (who read) — only enabled employees
  // ========================
  async getReadList(announcementId: number, query: ReadListQuery) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const readWhere = {
      announcementId,
      user: { role: 'EMPLOYEE' as const, status: 'ENABLED' as const },
    };

    const [reads, total] = await Promise.all([
      prisma.announcementRead.findMany({
        where: readWhere,
        skip,
        take: pageSize,
        orderBy: { firstReadAt: 'desc' },
        select: {
          firstReadAt: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.announcementRead.count({ where: readWhere }),
    ]);

    const items = reads.map((r) => ({
      userId: r.user.id,
      name: r.user.name,
      username: r.user.username,
      department: r.user.department ? { id: r.user.department.id, name: r.user.department.name } : null,
      firstReadAt: r.firstReadAt,
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Admin: Unread List
  // ========================
  async getUnreadList(announcementId: number, query: ReadListQuery) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    // Get IDs of users who have read
    const readUserIds = await prisma.announcementRead.findMany({
      where: { announcementId },
      select: { userId: true },
    });
    const readIds = readUserIds.map((r) => r.userId);

    const where = {
      role: 'EMPLOYEE' as const,
      status: 'ENABLED' as const,
      id: { notIn: readIds },
    };

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
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map((u) => ({
      userId: u.id,
      name: u.name,
      username: u.username,
      department: u.department ? { id: u.department.id, name: u.department.name } : null,
    }));

    return { items, total, page, pageSize };
  }

  // ========================
  // Helpers
  // ========================
  private formatAnnouncement(a: {
    id: number;
    title: string;
    content: string;
    status: string;
    publisherId: number;
    publishedAt: Date | null;
    withdrawnAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: a.id,
      title: a.title,
      content: a.content,
      status: a.status,
      publisherId: a.publisherId,
      publishedAt: a.publishedAt,
      withdrawnAt: a.withdrawnAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}

export const announcementService = new AnnouncementService();
