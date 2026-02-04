import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { csrfProtection } from '../middleware/csrf.js';
import { hashPassword } from '../auth/password.js';

export async function usersRoutes(fastify: FastifyInstance) {
  // List users (Owner/Admin only)
  fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: (request.user as any)?.sub },
      });

      if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }

      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      });

      reply.code(200).send(users);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to list users' });
    }
  });

  // Create user (Owner/Admin only)
  fastify.post(
    '/create',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: (request.user as any)?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const { username, password, email, role } = request.body as {
          username: string;
          password: string;
          email?: string;
          role: string;
        };

        if (!username || !password || username.length < 3 || password.length < 8) {
          return reply.code(400).send({
            error: 'Username must be at least 3 characters, password at least 8',
          });
        }

        if (!['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'].includes(role)) {
          return reply.code(400).send({ error: 'Invalid role' });
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          return reply.code(400).send({ error: 'Username already exists' });
        }

        const passwordHash = await hashPassword(password);

        const newUser = await prisma.user.create({
          data: {
            username,
            email,
            passwordHash,
            role,
            isActive: true,
          },
        });

        await logAuditAction(
          user.id,
          'USER_CREATE',
          'user',
          newUser.id,
          { username, role },
          request.ip
        );

        reply.code(201).send({
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
        });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create user' });
      }
    }
  );

  // Update user (Owner/Admin only)
  fastify.put(
    '/:id',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: (request.user as any)?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const { id } = request.params as { id: string };
        const { role, isActive, password } = request.body as {
          role?: string;
          isActive?: boolean;
          password?: string;
        };

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
          return reply.code(404).send({ error: 'User not found' });
        }

        const updateData: any = {};
        if (role && ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'].includes(role)) {
          updateData.role = role;
        }
        if (isActive !== undefined) {
          updateData.isActive = isActive;
        }
        if (password && password.length >= 8) {
          updateData.passwordHash = await hashPassword(password);
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
        });

        await logAuditAction(
          user.id,
          'USER_UPDATE',
          'user',
          id,
          { role: updateData.role, isActive: updateData.isActive },
          request.ip
        );

        reply.code(200).send({
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
        });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update user' });
      }
    }
  );

  // Delete user (Owner/Admin only - prevent deleting self and last Owner)
  fastify.delete(
    '/:id',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: (request.user as any)?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const { id } = request.params as { id: string };

        // Prevent deleting self
        if (id === user.id) {
          return reply.code(400).send({ error: 'Cannot delete yourself' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
          return reply.code(404).send({ error: 'User not found' });
        }

        // Prevent deleting if user is OWNER (unless there are other OWNERs)
        if (targetUser.role === 'OWNER') {
          const ownerCount = await prisma.user.count({ where: { role: 'OWNER' } });
          if (ownerCount <= 1) {
            return reply.code(403).send({ error: 'Cannot delete the last Owner' });
          }
        }

        const deletedUser = await prisma.user.delete({
          where: { id },
        });

        await logAuditAction(
          user.id,
          'USER_DELETE',
          'user',
          id,
          { username: deletedUser.username, role: deletedUser.role },
          request.ip
        );

        reply.code(200).send({ message: 'User deleted' });
      } catch (error) {
        console.error('Failed to delete user:', error);
        reply.code(500).send({ error: 'Failed to delete user' });
      }
    }
  );
}
