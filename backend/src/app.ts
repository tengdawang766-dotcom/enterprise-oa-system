import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './infrastructure/config';
import { globalExceptionHandler } from './common/exception/global-exception-handler';
import { prisma } from './infrastructure/database/prisma';
import { authRouter } from './modules/auth/auth.controller';
import { meRouter } from './modules/me/me.controller';
import { meAnnouncementRouter } from './modules/me/me-announcement.controller';
import { departmentRouter } from './modules/department/department.controller';
import { userRouter } from './modules/user/user.controller';
import { announcementRouter } from './modules/announcement/announcement.controller';
import { directoryRouter } from './modules/directory/directory.controller';
import { leaveRouter } from './modules/leave/leave.controller';
import { meLeaveRouter } from './modules/me/me-leave.controller';
import { meApprovalRouter } from './modules/me/me-approval.controller';
import { knowledgeRouter } from './modules/knowledge/knowledge.controller';
import { adminKnowledgeRouter } from './modules/knowledge/admin.controller';
import { authenticationMiddleware, forcePasswordChangeMiddleware, requireRole } from './common/auth/authentication';

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(config.COOKIE_SECRET));

  // Routes - auth doesn't need authentication
  app.use('/api/v1/auth', authRouter);

  // Protected routes - require authentication + force password change check
  app.use('/api/v1/me', authenticationMiddleware, forcePasswordChangeMiddleware, meRouter);

  // Admin-only routes
  app.use(
    '/api/v1/departments',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('ADMIN'),
    departmentRouter
  );

  app.use(
    '/api/v1/users',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('ADMIN'),
    userRouter
  );

  // Admin announcement management
  app.use(
    '/api/v1/announcements',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('ADMIN'),
    announcementRouter
  );

  // Employee announcements (under /me)
  app.use(
    '/api/v1/me/announcements',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('EMPLOYEE'),
    meAnnouncementRouter
  );

  // Directory (accessible by all authenticated users who completed password change)
  app.use(
    '/api/v1/directory',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('ADMIN', 'EMPLOYEE'),
    directoryRouter
  );

  // Leave requests - employee actions (create, cancel, approve, reject, edit, resubmit)
  app.use(
    '/api/v1/leave-requests',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('EMPLOYEE'),
    leaveRouter
  );

  // My leave requests (employee queries)
  app.use(
    '/api/v1/me/leave-requests',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('EMPLOYEE'),
    meLeaveRouter
  );

  // Approval endpoints (manager queries)
  app.use(
    '/api/v1/me',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('EMPLOYEE'),
    meApprovalRouter
  );

  // Knowledge sharing — EMPLOYEE only (department managers use EMPLOYEE role)
  app.use(
    '/api/v1/knowledge',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('EMPLOYEE'),
    knowledgeRouter
  );

  // Admin knowledge management
  app.use(
    '/api/v1/admin/knowledge',
    authenticationMiddleware,
    forcePasswordChangeMiddleware,
    requireRole('ADMIN'),
    adminKnowledgeRouter
  );

  // Liveness probe - always returns 200 if the process is running
  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  // Readiness probe - checks database connectivity
  app.get('/api/v1/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: 'ready', database: 'connected' } });
    } catch (err) {
      res.status(503).json({
        success: false,
        error: { code: 'NOT_READY', message: 'Database connection failed' },
      });
    }
  });

  // Global exception handler
  app.use(globalExceptionHandler);

  return app;
}
