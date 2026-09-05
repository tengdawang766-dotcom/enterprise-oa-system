import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'default-cookie-secret',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
