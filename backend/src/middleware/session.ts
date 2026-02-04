import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';

export async function attachSession(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const sessionToken = request.cookies.session_token;

  if (!sessionToken) {
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      reply.clearCookie('session_token');
      return;
    }

    request.user = { sub: session.userId };
  } catch (error) {
    // Session not found or expired
  }
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date
) {
  reply.cookie('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie('session_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
