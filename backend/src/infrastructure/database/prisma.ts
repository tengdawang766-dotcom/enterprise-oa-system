import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
});

prisma.$on('error', (e) => {
  logger.error({ target: e.target }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ target: e.target }, 'Prisma warning');
});
