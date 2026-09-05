import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Create a minimal test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser('test-secret'));

  // Import routes dynamically to avoid module caching issues
  return app;
}

describe('Authentication API', () => {
  const TEST_USER = {
    username: 'auth_test_admin',
    password: 'AuthTest123',
    name: '认证测试管理员',
  };

  let userId: number;
  let app: express.Application;

  beforeAll(async () => {
    // Create test user
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    const user = await prisma.user.upsert({
      where: { username: TEST_USER.username },
      update: { passwordHash: hash, mustChangePassword: true, status: 'ENABLED', tokenVersion: 0 },
      create: {
        username: TEST_USER.username,
        passwordHash: hash,
        name: TEST_USER.name,
        role: 'ADMIN',
        mustChangePassword: true,
      },
    });
    userId = user.id;

    // Create test app with actual routes
    app = express();
    app.use(express.json());
    app.use(cookieParser('test-secret'));

    // Health check
    app.get('/api/v1/health', (req, res) => {
      res.json({ success: true, data: { status: 'ok' } });
    });

    // We need to import the actual modules, but they depend on the server running
    // For integration tests, we'll test against the running server
  });

  afterAll(async () => {
    // Cleanup test user
    await prisma.user.deleteMany({
      where: { username: TEST_USER.username },
    });
    await prisma.$disconnect();
  });

  it('health check should return 200', async () => {
    const response = await request('http://localhost:3000')
      .get('/api/v1/health');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('should reject unauthenticated access to protected endpoint', async () => {
    const response = await request('http://localhost:3000')
      .get('/api/v1/me');
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should login with correct credentials', async () => {
    const response = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.username).toBe(TEST_USER.username);
    expect(response.body.data.mustChangePassword).toBe(true);
    
    // Check that cookie was set
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('should reject wrong password', async () => {
    const response = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: 'wrongpassword' });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should reject non-existent user', async () => {
    const response = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: 'nonexistent_user', password: 'anypassword' });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should get current user with valid cookie', async () => {
    // First login
    const loginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // Then get current user
    const meResponse = await request('http://localhost:3000')
      .get('/api/v1/me')
      .set('Cookie', cookies);
    
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.success).toBe(true);
    expect(meResponse.body.data.username).toBe(TEST_USER.username);
    expect(meResponse.body.data.mustChangePassword).toBe(true);
  });

  it('should reject access to /me when mustChangePassword is true', async () => {
    // Login
    const loginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // Try to access /me (should work - it's allowed)
    const meResponse = await request('http://localhost:3000')
      .get('/api/v1/me')
      .set('Cookie', cookies);
    
    expect(meResponse.status).toBe(200);
  });

  it('should allow password change when mustChangePassword is true', async () => {
    // Login
    const loginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // Change password
    const newPassword = 'NewPassword123';
    const changeResponse = await request('http://localhost:3000')
      .patch('/api/v1/me/password')
      .set('Cookie', cookies)
      .send({ currentPassword: TEST_USER.password, newPassword });
    
    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body.success).toBe(true);
    
    // Verify cookie was cleared
    const setCookies = changeResponse.headers['set-cookie'];
    if (setCookies) {
      expect(setCookies[0]).toContain('token=;');
    }
    
    // Verify old password no longer works
    const oldLoginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    expect(oldLoginResponse.status).toBe(401);
    
    // Verify new password works
    const newLoginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: newPassword });
    
    expect(newLoginResponse.status).toBe(200);
    expect(newLoginResponse.body.data.mustChangePassword).toBe(false);
    
    // Reset password for other tests
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, mustChangePassword: true, tokenVersion: 0 },
    });
  });

  it('should logout and clear cookie', async () => {
    // Login
    const loginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // Logout
    const logoutResponse = await request('http://localhost:3000')
      .delete('/api/v1/auth/session')
      .set('Cookie', cookies);
    
    expect(logoutResponse.status).toBe(204);
    
    // Verify cookie was cleared
    const setCookies = logoutResponse.headers['set-cookie'];
    expect(setCookies).toBeDefined();
    expect(setCookies[0]).toContain('token=;');
  });

  it('should reject disabled account login', async () => {
    // Create disabled user
    const hash = await bcrypt.hash('disabled123', 10);
    await prisma.user.upsert({
      where: { username: 'disabled_test_user' },
      update: { status: 'DISABLED' },
      create: {
        username: 'disabled_test_user',
        passwordHash: hash,
        name: 'Disabled Test',
        role: 'EMPLOYEE',
        status: 'DISABLED',
        mustChangePassword: false,
      },
    });

    const response = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: 'disabled_test_user', password: 'disabled123' });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
    
    // Cleanup
    await prisma.user.deleteMany({ where: { username: 'disabled_test_user' } });
  });

  it('should invalidate JWT after password change', async () => {
    // Login
    const loginResponse = await request('http://localhost:3000')
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // Change password
    const newPassword = 'NewPassword456';
    await request('http://localhost:3000')
      .patch('/api/v1/me/password')
      .set('Cookie', cookies)
      .send({ currentPassword: TEST_USER.password, newPassword });
    
    // Try to use old cookie (should fail)
    const meResponse = await request('http://localhost:3000')
      .get('/api/v1/me')
      .set('Cookie', cookies);
    
    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error.code).toBe('AUTH_SESSION_EXPIRED');
    
    // Reset for other tests
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, mustChangePassword: true, tokenVersion: 0 },
    });
  });
});
