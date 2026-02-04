import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { hashPassword } from '../auth/password.js';

export async function setupRoutes(fastify: FastifyInstance) {
  // Check if setup is needed
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const userCount = await prisma.user.count();
    reply.code(200).send({
      needsSetup: userCount === 0,
    });
  });

  // Create first user (Owner)
  fastify.post(
    '/create-owner',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return reply.code(403).send({ error: 'Setup already complete' });
      }

      const { username, password, email } = request.body as {
        username: string;
        password: string;
        email?: string;
      };

      if (!username || !password || username.length < 3 || password.length < 8) {
        return reply.code(400).send({
          error: 'Username must be at least 3 characters, password at least 8',
        });
      }

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return reply.code(400).send({ error: 'Username already exists' });
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: 'OWNER',
          isActive: true,
        },
      });

      const token = fastify.jwt.sign({ sub: user.id });

      reply.code(201).send({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    }
  );
}
