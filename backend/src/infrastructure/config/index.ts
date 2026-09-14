import dotenv from 'dotenv';

dotenv.config();

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

function requireSecret(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} is required in production`);
  }
  return devDefault;
}

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: requireSecret('JWT_SECRET', 'default-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  COOKIE_SECRET: requireSecret('COOKIE_SECRET', 'default-cookie-secret'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // AI configuration
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_BASE_URL: process.env.AI_BASE_URL || '',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
};
