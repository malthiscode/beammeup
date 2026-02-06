import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { configureAuth } from './auth/index.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { auditLogger } from './middleware/audit-logger.js';
import { attachSession } from './middleware/session.js';

console.log('[index.ts] Module loading...');

const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  FASTIFY_PORT: parseInt(process.env.FASTIFY_PORT || '3000', 10),
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
};

console.log('[index.ts] Initializing Prisma...');
export const prisma = new PrismaClient();
console.log('[index.ts] Prisma initialized');

export async function createApp() {
  const fastify = Fastify({
    logger: ENV.NODE_ENV === 'development',
    trustProxy: true,
    requestTimeout: 30000, // 30 second timeout
    bodyLimit: 100 * 1024 * 1024, // 100MB max request size
  });

  // Security headers via Helmet
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes',
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: process.env.REDIS_URL,
  });

  // Utilities
  await fastify.register(sensible);
  await fastify.register(cookie);
  const maxModSizeMb = parseInt(process.env.MAX_MOD_SIZE || '1024', 10);
  await fastify.register(multipart, {
    limits: {
      fileSize: maxModSizeMb * 1024 * 1024,
    },
  });

  // Auth configuration
  configureAuth(fastify, ENV.SESSION_SECRET);

  // Middleware
  fastify.addHook('preHandler', attachSession);
  fastify.addHook('preHandler', auditLogger);

  // Routes
  setupRoutes(fastify);

  // Error handler
  fastify.setErrorHandler(errorHandler);

  return fastify;
}

export async function start() {
  try {
    console.log('[start] Creating app...');
    const fastify = await createApp();

    console.log('[start] Listening on port', ENV.FASTIFY_PORT);
    await fastify.listen({ port: ENV.FASTIFY_PORT, host: '0.0.0.0' });
    console.log('[start] Server listening on port', ENV.FASTIFY_PORT);
    fastify.log.info(`Server listening on port ${ENV.FASTIFY_PORT}`);
  } catch (err) {
    console.error('[start] FATAL ERROR:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[index.ts] Starting server...');
  start().catch(err => {
    console.error('[index.ts] Unhandled error:', err);
    process.exit(1);
  });
}
