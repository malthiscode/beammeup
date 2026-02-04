import { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export async function csrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // GET requests don't need CSRF protection
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return;
  }

  const tokenFromHeader = request.headers['x-csrf-token'] as string;
  const tokenFromCookie = request.cookies.csrf_token;

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    reply.code(403).send({ error: 'CSRF token validation failed' });
  }
}

export async function issueCSRFToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = generateCsrfToken();
  reply.cookie('csrf_token', token, {
    httpOnly: false, // Front-end needs to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  reply.code(200).send({ csrf_token: token });
}
