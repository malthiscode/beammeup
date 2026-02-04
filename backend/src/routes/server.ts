import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { csrfProtection } from '../middleware/csrf.js';
import { restartBeamMP, getContainerStatus, getContainerUptime, getContainerLogs } from '../services/docker.js';

export async function serverRoutes(fastify: FastifyInstance) {
  // Get server status
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const containerName = process.env.BEAMMP_CONTAINER_NAME || 'beammp';
      const status = await getContainerStatus(containerName);
      const uptime = await getContainerUptime(containerName);

      reply.code(200).send({
        running: status.running,
        state: status.state,
        uptime: uptime || 0,
      });
    } catch (error) {
      console.error('Failed to get server status:', error);
      reply.code(500).send({ error: 'Failed to get server status' });
    }
  });

  // Restart BeamMP server (Owner/Admin/Operator)
  fastify.post(
    '/restart',
    { preHandler: csrfProtection },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: request.user?.sub },
        });

        if (!user || !['OWNER', 'ADMIN', 'OPERATOR'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        await restartBeamMP();

        await logAuditAction(
          user.id,
          'SERVER_RESTART',
          'server',
          undefined,
          {},
          request.ip
        );

        reply.code(200).send({ message: 'Server restart initiated' });
      } catch (error) {
        console.error('Failed to restart server:', error);
        reply.code(500).send({ error: 'Failed to restart server' });
      }
    }
  );

  // Get server logs
  fastify.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: request.user?.sub },
      });

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const containerName = process.env.BEAMMP_CONTAINER_NAME || 'beammp';
      const lines = Math.min(parseInt(request.query.lines as string) || 200, 1000); // Cap at 1000
      const logs = await getContainerLogs(containerName, lines);

      await logAuditAction(
        user.id,
        'LOGS_VIEW',
        'server',
        undefined,
        {},
        request.ip
      );

      reply.code(200).send({
        logs,
        lineCount: logs.split('\n').length,
      });
    } catch (error) {
      console.error('Failed to get logs:', error);
      reply.code(500).send({ error: 'Failed to retrieve logs' });
    }
  });
}
