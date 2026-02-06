import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { csrfProtection } from '../middleware/csrf.js';
import { verifyPassword } from '../auth/password.js';
import { readConfigFile, writeConfigFile, backupConfigFile, validateConfig } from '../services/config.js';

export async function configRoutes(fastify: FastifyInstance) {
  // Get current config
  fastify.get('/current', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: (request.user as any)?.sub },
      });

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const config = await readConfigFile();

      await logAuditAction(
        user.id,
        'CONFIG_VIEW',
        'config',
        undefined,
        {},
        (request as any).auditContext?.ipAddress
      );

      // Never expose AuthKey
      const safeConfig = { ...config };
      if (safeConfig.General) {
        safeConfig.General = { ...safeConfig.General };
        delete (safeConfig.General as any).AuthKey;
      }

      reply.code(200).send(safeConfig);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to read config' });
    }
  });

  // Check if AuthKey is set
  fastify.get('/authkey-status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const config = await readConfigFile();
      const authKey = config.General?.AuthKey;
      const isDefault = authKey === 'CHANGE_ME_TO_YOUR_BEAMMP_AUTH_KEY';
      const isSet = !!authKey && !isDefault;

      reply.code(200).send({ isSet, isDefault });
    } catch {
      reply.code(500).send({ error: 'Failed to check AuthKey' });
    }
  });

  // Update config (Owner/Admin/Operator)
  fastify.put('/update', { preHandler: csrfProtection }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAuth(request, reply);

      const user = await prisma.user.findUnique({
        where: { id: (request.user as any)?.sub },
      });

      if (!user || !['OWNER', 'ADMIN', 'OPERATOR'].includes(user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }

      const newConfig = request.body as any;

      // Validate config
      const errors = validateConfig(newConfig);
      if (errors.length > 0) {
        return reply.code(400).send({ errors });
      }

      // Get old config for diff
      const oldConfig = await readConfigFile();
      
      // CRITICAL: Preserve AuthKey from old config (never sent to frontend for security)
      if (oldConfig.General?.AuthKey) {
        if (!newConfig.General) {
          newConfig.General = {};
        }
        newConfig.General.AuthKey = oldConfig.General.AuthKey;
      }
      
      const diff = computeConfigDiff(oldConfig, newConfig);

      // Backup old config
      await backupConfigFile(oldConfig);

      // Write new config (with preserved AuthKey)
      await writeConfigFile(newConfig);

      await logAuditAction(
        user.id,
        'CONFIG_UPDATE',
        'config',
        undefined,
        diff,
        request.ip
      );

      reply.code(200).send({ message: 'Config updated successfully' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update config' });
    }
  });

  // Replace AuthKey (Owner/Admin only - requires password re-auth)
  fastify.post(
    '/authkey-replace',
    { preHandler: csrfProtection, rateLimit: { max: 3, timeWindow: '1 hour' } } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request, reply);

        const user = await prisma.user.findUnique({
          where: { id: (request.user as any)?.sub },
        });

        if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions' });
        }

        const { newAuthKey, password } = request.body as {
          newAuthKey: string;
          password: string;
        };

        // Re-auth: verify password
        const passwordMatch = await verifyPassword(password, user.passwordHash);
        if (!passwordMatch) {
          return reply.code(401).send({ error: 'Invalid password' });
        }

        if (!newAuthKey || newAuthKey.length < 10) {
          return reply.code(400).send({ error: 'Invalid AuthKey format' });
        }

        const config = await readConfigFile();

        // Backup before change
        await backupConfigFile(config);

        // Update AuthKey
        config.General.AuthKey = newAuthKey;
        await writeConfigFile(config);

        await logAuditAction(
          user.id,
          'AUTHKEY_REPLACE',
          'config',
          undefined,
          { changed: true },
          request.ip
        );

        reply.code(200).send({ message: 'AuthKey updated successfully' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update AuthKey' });
      }
    }
  );
}

function computeConfigDiff(
  oldConfig: any,
  newConfig: any,
  prefix = ''
): Record<string, any> {
  const diff: Record<string, any> = {};

  for (const key in newConfig) {
    const oldValue = oldConfig?.[key];
    const newValue = newConfig[key];

    if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
      const nested = computeConfigDiff(oldValue || {}, newValue, `${prefix}${key}.`);
      if (Object.keys(nested).length > 0) {
        diff[key] = nested;
      }
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff[key] = {
        old: oldValue,
        new: newValue,
      };
    }
  }

  return diff;
}
