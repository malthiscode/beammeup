import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function requireRole(
  ...allowedRoles: string[]
): Promise<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);

    const user = await prisma.user.findUnique({
      where: { id: (request.user as any)?.sub },
    });

    if (!user || !allowedRoles.includes(user.role)) {
      reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

export async function checkFirstRun(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userCount = await prisma.user.count();
  
  if (userCount === 0 && !request.url.startsWith('/api/setup')) {
    reply.code(307).redirect('/setup');
  }
}
