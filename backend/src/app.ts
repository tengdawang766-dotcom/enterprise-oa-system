import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './infrastructure/config';
import { logger } from './common/logger';
import { globalExceptionHandler } from './common/exception/global-exception-handler';
import { authRouter } from './modules/auth/auth.controller';
import { meRouter } from './modules/me/me.controller';
import { authenticationMiddleware, forcePasswordChangeMiddleware } from './common/auth/authentication';

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

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Global exception handler
app.use(globalExceptionHandler);

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
