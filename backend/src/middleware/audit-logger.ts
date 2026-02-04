import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';

export async function auditLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Store request info for later use in response handler
  const startTime = Date.now();
  
  request.auditContext = {
    userId: request.user?.sub,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    method: request.method,
    url: request.url,
  };

  // Hook into the response to log sensitive actions
  reply.addHook('onResponse', async () => {
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      request.log.warn(`Slow request: ${request.method} ${request.url} (${duration}ms)`);
    }
  });
}

declare global {
  namespace FastifyRequest {
    interface FastifyRequest {
      auditContext?: {
        userId?: string;
        ipAddress: string;
        userAgent?: string;
        method: string;
        url: string;
      };
    }
  }
}

export async function logAuditAction(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: action as any,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}
