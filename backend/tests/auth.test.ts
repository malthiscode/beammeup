import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/index.js';
import { prisma } from '../src/index.js';

describe('Auth Routes', () => {
  let fastify: any;

  beforeAll(async () => {
    // Reset database
    await prisma.user.deleteMany({});
    fastify = await createApp();
  });

  afterAll(async () => {
    await fastify.close();
    await prisma.$disconnect();
  });

  it('should setup first user', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/setup/create-owner',
      payload: {
        username: 'admin',
        password: 'password123',
        email: 'admin@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.user.username).toBe('admin');
    expect(body.user.role).toBe('OWNER');
    expect(body.token).toBeDefined();
  });

  it('should login with correct credentials', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'admin',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'admin',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get current user with valid token', async () => {
    // First login
    const loginResponse = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'admin',
        password: 'password123',
      },
    });

    const { token } = JSON.parse(loginResponse.body);

    // Get current user
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.username).toBe('admin');
  });

  it('should prevent double setup', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/setup/create-owner',
      payload: {
        username: 'admin2',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
