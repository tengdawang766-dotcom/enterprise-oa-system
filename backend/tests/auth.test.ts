import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';

const prisma = new PrismaClient();
const app = createApp();

const TEST_USER = {
  username: 'auth_test_admin',
  password: 'AuthTest123',
  name: '认证测试管理员',
};

const TEST_DISABLED = {
  username: 'auth_test_disabled',
  password: 'DisabledTest123',
  name: '停用测试用户',
};

let userId: number;

beforeAll(async () => {
  // Create test users
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

  const disHash = await bcrypt.hash(TEST_DISABLED.password, 10);
  await prisma.user.upsert({
    where: { username: TEST_DISABLED.username },
    update: { passwordHash: disHash, status: 'DISABLED', mustChangePassword: false },
    create: {
      username: TEST_DISABLED.username,
      passwordHash: disHash,
      name: TEST_DISABLED.name,
      role: 'EMPLOYEE',
      status: 'DISABLED',
      mustChangePassword: false,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { username: { in: [TEST_USER.username, TEST_DISABLED.username] } },
  });
  await prisma.$disconnect();
});

describe('Health Check', () => {
  it('GET /api/v1/health should return 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('Authentication', () => {
  it('should reject unauthenticated access to protected endpoint', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(TEST_USER.username);
    expect(res.body.data.mustChangePassword).toBe(true);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should reject non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: 'nonexistent_xyz', password: 'any' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('should reject disabled account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_DISABLED.username, password: TEST_DISABLED.password });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('should get current user with valid cookie', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(TEST_USER.username);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('should logout and clear cookie', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    const res = await request(app)
      .delete('/api/v1/auth/session')
      .set('Cookie', cookies);

    expect(res.status).toBe(204);
    const setCookies = res.headers['set-cookie'];
    expect(setCookies).toBeDefined();
    expect(setCookies[0]).toContain('token=;');
  });
});

describe('Force Password Change', () => {
  it('should allow GET /me when mustChangePassword is true', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('should allow PATCH /me/password when mustChangePassword is true', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    const res = await request(app)
      .patch('/api/v1/me/password')
      .set('Cookie', cookies)
      .send({ currentPassword: TEST_USER.password, newPassword: 'NewPass123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Reset password for other tests
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, mustChangePassword: true, tokenVersion: 0 },
    });
  });

  it('should reject non-whitelisted endpoint when mustChangePassword is true', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    // /api/v1/me/contact is not whitelisted
    const res = await request(app)
      .patch('/api/v1/me/contact')
      .set('Cookie', cookies)
      .send({ workEmail: 'test@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('Password Change & JWT Invalidation', () => {
  it('should change password and invalidate old JWT', async () => {
    const newPassword = 'NewJwtTest123';

    // Login
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const cookies = login.headers['set-cookie'];

    // Change password
    const changeRes = await request(app)
      .patch('/api/v1/me/password')
      .set('Cookie', cookies)
      .send({ currentPassword: TEST_USER.password, newPassword });

    expect(changeRes.status).toBe(200);

    // Old JWT should be invalid
    const oldRes = await request(app)
      .get('/api/v1/me')
      .set('Cookie', cookies);

    expect(oldRes.status).toBe(401);
    expect(oldRes.body.error.code).toBe('AUTH_SESSION_EXPIRED');

    // Old password should not work
    const oldLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    expect(oldLogin.status).toBe(401);

    // New password should work
    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ username: TEST_USER.username, password: newPassword });

    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.mustChangePassword).toBe(false);

    // Reset for other tests
    const hash = await bcrypt.hash(TEST_USER.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, mustChangePassword: true, tokenVersion: 0 },
    });
  });
});
