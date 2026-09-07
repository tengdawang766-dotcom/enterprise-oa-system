import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './infrastructure/config';
import { globalExceptionHandler } from './common/exception/global-exception-handler';
import { authRouter } from './modules/auth/auth.controller';
import { meRouter } from './modules/me/me.controller';
import { meAnnouncementRouter } from './modules/me/me-announcement.controller';
import { departmentRouter } from './modules/department/department.controller';
import { userRouter } from './modules/user/user.controller';
import { announcementRouter } from './modules/announcement/announcement.controller';
import { directoryRouter } from './modules/directory/directory.controller';
import { authenticationMiddleware, forcePasswordChangeMiddleware, requireRole } from './common/auth/authentication';

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());
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

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  // Global exception handler
  app.use(globalExceptionHandler);

  return app;
}
