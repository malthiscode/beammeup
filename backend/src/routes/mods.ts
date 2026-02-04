import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { csrfProtection } from '../middleware/csrf.js';
import { uploadMod, deleteMod, listMods } from '../services/mods.js';

export async function modsRoutes(fastify: FastifyInstance) {
  // List mods (all authenticated users)
  fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const mods = await listMods();
      reply.code(200).send(mods);
    } catch (error) {
      console.error('Failed to list mods:', error);
      reply.code(500).send({ error: 'Failed to list mods' });
    }
  });

  // Upload mod (Owner/Admin only)
  fastify.post(
    '/upload',
    { preHandler: csrfProtection, rateLimit: { max: 10, timeWindow: '1 hour' } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: request.user?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();
        const modData = await uploadMod(buffer, data.filename, user.id);

        await logAuditAction(
          user.id,
          'MOD_UPLOAD',
          'mod',
          modData.id,
          { filename: data.filename, sha256: modData.sha256 },
          request.ip
        );

        reply.code(201).send(modData);
      } catch (error: any) {
        console.error('Failed to upload mod:', error);
        const message = error.message || 'Failed to upload mod';
        reply.code(400).send({ error: message });
      }
    }
  );

  // Delete mod (Owner/Admin only)
  fastify.delete(
    '/:id',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: request.user?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const { id } = request.params as { id: string };
        const mod = await deleteMod(id);

        if (!mod) {
          return reply.code(404).send({ error: 'Mod not found' });
        }

        await logAuditAction(
          user.id,
          'MOD_DELETE',
          'mod',
          id,
          { filename: mod.filename },
          request.ip
        );

        reply.code(200).send({ message: 'Mod deleted' });
      } catch (error) {
        console.error('Failed to delete mod:', error);
        reply.code(500).send({ error: 'Failed to delete mod' });
      }
    }
  );
}
