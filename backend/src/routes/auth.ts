import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { csrfProtection, issueCSRFToken } from '../middleware/csrf.js';
import { setSessionCookie, clearSessionCookie } from '../middleware/session.js';
import { validateLoginRequest } from '../lib/validation.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Get CSRF token
  fastify.get('/csrf', async (request: FastifyRequest, reply: FastifyReply) => {
    await issueCSRFToken(request, reply);
  });

  // Login
  fastify.post(
    '/login',
    { preHandler: csrfProtection, rateLimit: { max: 5, timeWindow: '15 minutes' } } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.body as any;
      const errors = validateLoginRequest(payload);

      if (errors.length > 0) {
        return reply.code(400).send({ error: 'Validation failed', errors });
      }

      const { username, password } = payload;

      const user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const passwordMatch = await verifyPassword(password, user.passwordHash);
      if (!passwordMatch) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return reply.code(403).send({ error: 'User is inactive' });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Create session
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: fastify.jwt.sign({ sub: user.id }),
          expiresAt,
          ipAddress: request.ip,
        },
      });

      setSessionCookie(reply, session.token, expiresAt);

      await logAuditAction(
        user.id,
        'USER_LOGIN',
        'user',
        user.id,
        {},
        request.ip
      );

      reply.code(200).send({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    }
  );

  // Logout
  fastify.post(
    '/logout',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const userId = (request.user as any)?.sub;

        if (userId) {
          // Delete all sessions for this user
          await prisma.session.deleteMany({ where: { userId } });

          await logAuditAction(
            userId,
            'USER_LOGOUT',
            'user',
            userId,
            {},
            request.ip
          );
        }

        clearSessionCookie(reply);
        reply.code(200).send({ message: 'Logged out' });
      } catch {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }
  );

  // Get current user
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = await prisma.user.findUnique({
        where: { id: (request.user as any)?.sub },
        select: { id: true, username: true, role: true, email: true },
      });

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      reply.code(200).send(user);
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
