import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { setupRoutes as setupInitRoutes } from './setup.js';
import { configRoutes } from './config.js';
import { modsRoutes } from './mods.js';
import { usersRoutes } from './users.js';
import { auditRoutes } from './audit.js';
import { serverRoutes } from './server.js';
import { diagnosticsRoutes } from './diagnostics.js';

export function setupRoutes(fastify: FastifyInstance) {
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(setupInitRoutes, { prefix: '/api/setup' });
  fastify.register(configRoutes, { prefix: '/api/config' });
  fastify.register(modsRoutes, { prefix: '/api/mods' });
  fastify.register(usersRoutes, { prefix: '/api/users' });
  fastify.register(auditRoutes, { prefix: '/api/audit' });
  fastify.register(serverRoutes, { prefix: '/api/server' });
  fastify.register(diagnosticsRoutes, { prefix: '/api/diagnostics' });

  // Health check
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });
}
