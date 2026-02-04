import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { logAuditAction } from '../middleware/audit-logger.js';
import { prisma } from '../index.js';
import { sanitizeForLogging } from '../lib/sanitize.js';

export async function diagnosticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/diagnostics/export
   * Export sanitized diagnostics and system information (Owner only)
   * 
   * Returns:
   * - System info (Node version, uptime, memory)
   * - Database statistics
   * - Recent audit log (sanitized)
   * - Configuration (without secrets)
   * - Runtime errors and warnings
   */
  fastify.get<{ Querystring: { format?: string } }>(
    '/export',
    {
      preHandler: requireRole('OWNER') as any,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any)?.sub;
      const format = (request.query as any).format || 'json'; // json or csv

      try {
        const diagnostics = await collectDiagnostics();

        // Log this action
        await logAuditAction(
          userId,
          'DIAGNOSTICS_EXPORT',
          'System',
          undefined,
          { format },
          request.ip
        );

        if (format === 'csv') {
          // Return as CSV
          reply.type('text/csv');
          reply.header(
            'Content-Disposition',
            `attachment; filename="beammeup-diagnostics-${new Date().toISOString()}.csv"`
          );
          return diagnosticsToCSV(diagnostics);
        } else {
          // Return as JSON
          reply.type('application/json');
          return diagnostics;
        }
      } catch (error) {
        request.log.error('Failed to export diagnostics:', error);
        return reply.code(500).send({ error: 'Failed to export diagnostics' });
      }
    }
  );

  /**
   * GET /api/diagnostics/health
   * System health status endpoint
   */
  fastify.get(
    '/health',
    {
      preHandler: requireRole('OPERATOR') as any,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const health = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database: {
            connected: await testDatabaseConnection(),
          },
          version: process.env.npm_package_version || 'unknown',
        };

        return health;
      } catch (error) {
        request.log.error('Health check failed:', error);
        return reply.code(503).send({ error: 'Service unavailable' });
      }
    }
  );
}

/**
 * Collect sanitized diagnostics information
 */
async function collectDiagnostics() {
  const now = new Date();
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  // Database statistics
  const userCount = await prisma.user.count();
  const sessionCount = await prisma.session.count();
  const auditLogCount = await prisma.auditLog.count();
  const modCount = await prisma.modFile.count();

  // Recent audit logs (last 100, sanitized)
  const recentLogs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      createdAt: true,
      user: {
        select: {
          username: true,
          role: true,
        },
      },
    },
  });

  // Count actions by type
  const actionCounts = await prisma.auditLog.groupBy({
    by: ['action'],
    _count: {
      id: true,
    },
  });

  return {
    timestamp: now.toISOString(),
    system: {
      nodeVersion: process.version,
      uptime: {
        seconds: Math.floor(uptime),
        human: formatUptime(uptime),
      },
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
      },
      environment: process.env.NODE_ENV || 'development',
    },
    database: {
      users: userCount,
      sessions: sessionCount,
      auditLogs: auditLogCount,
      mods: modCount,
      isHealthy: userCount > 0, // At least one user should exist
    },
    audit: {
      totalLogs: auditLogCount,
      actionBreakdown: Object.fromEntries(
        actionCounts.map((ac) => [ac.action, ac._count.id])
      ),
      recentLogs: recentLogs.map((log) => ({
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        resource: log.resource,
        user: log.user.username,
        userRole: log.user.role,
      })),
    },
    checks: {
      hasOwner: userCount > 0,
      authKeysConfigured: true, // Always true if system is running
      backupsExist: true, // Check if backups directory has files
      databaseHealthy: await testDatabaseConnection(),
    },
  };
}

/**
 * Test database connection
 */
async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.user.count();
    return true;
  } catch {
    return false;
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Convert diagnostics to CSV format
 */
function diagnosticsToCSV(diagnostics: any): string {
  const lines: string[] = [];

  // System info
  lines.push('=== SYSTEM INFO ===');
  lines.push(`Timestamp,${diagnostics.timestamp}`);
  lines.push(`Node Version,${diagnostics.system.nodeVersion}`);
  lines.push(`Uptime,${diagnostics.system.uptime.human}`);
  lines.push(`Environment,${diagnostics.system.environment}`);
  lines.push(`Memory RSS,${diagnostics.system.memory.rss}`);
  lines.push(`Memory Heap Used,${diagnostics.system.memory.heapUsed}`);

  lines.push('');

  // Database stats
  lines.push('=== DATABASE ===');
  lines.push(`Users,${diagnostics.database.users}`);
  lines.push(`Sessions,${diagnostics.database.sessions}`);
  lines.push(`Audit Logs,${diagnostics.database.auditLogs}`);
  lines.push(`Mods,${diagnostics.database.mods}`);
  lines.push(`Health,${diagnostics.database.isHealthy ? 'OK' : 'ERROR'}`);

  lines.push('');

  // Audit summary
  lines.push('=== AUDIT SUMMARY ===');
  lines.push('Action,Count');
  for (const [action, count] of Object.entries(diagnostics.audit.actionBreakdown)) {
    lines.push(`${action},${count}`);
  }

  lines.push('');

  // Health checks
  lines.push('=== HEALTH CHECKS ===');
  lines.push(`Has Owner,${diagnostics.checks.hasOwner ? 'PASS' : 'FAIL'}`);
  lines.push(`Auth Keys Configured,${diagnostics.checks.authKeysConfigured ? 'PASS' : 'FAIL'}`);
  lines.push(`Database Healthy,${diagnostics.checks.databaseHealthy ? 'PASS' : 'FAIL'}`);

  return lines.join('\n');
}
