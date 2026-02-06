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
  // Use secure cookies only if the connection is actually HTTPS
  const request = reply.request;
  const isSecure = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
  
  reply.cookie('session_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  const request = reply.request;
  const isSecure = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
  
  reply.clearCookie('session_token', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
  });
}
