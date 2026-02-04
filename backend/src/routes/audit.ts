import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

export async function auditRoutes(fastify: FastifyInstance) {
  // Get audit logs (Owner/Admin only)
  fastify.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: request.user?.sub },
      });

      if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }

      const { limit = 100, offset = 0, action, resource } = request.query as {
        limit?: string;
        offset?: string;
        action?: string;
        resource?: string;
      };

      const where: any = {};
      if (action) where.action = action;
      if (resource) where.resource = resource;

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10) || 100,
        skip: parseInt(offset, 10) || 0,
      });

      const total = await prisma.auditLog.count({ where });

      reply.code(200).send({
        logs,
        total,
        limit: parseInt(limit, 10) || 100,
        offset: parseInt(offset, 10) || 0,
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch audit logs' });
    }
  });

  // Export audit logs as CSV (Owner/Admin only)
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: request.user?.sub },
      });

      if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }

      const logs = await prisma.auditLog.findMany({
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const csv = [
        'ID,Timestamp,User,Action,Resource,ResourceID,IPAddress,Details',
        ...logs.map(
          (log) =>
            `"${log.id}","${log.createdAt.toISOString()}","${log.user.username}","${log.action}","${log.resource}","${log.resourceId || ''}","${log.ipAddress || ''}","${(log.details || '').replace(/"/g, '""')}"`
        ),
      ].join('\n');

      reply.type('text/csv').code(200).send(csv);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to export audit logs' });
    }
  });
}
