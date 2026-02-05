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

const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  FASTIFY_PORT: parseInt(process.env.FASTIFY_PORT || '3000', 10),
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
};

export const prisma = new PrismaClient();

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
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
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
    const fastify = await createApp();

    await fastify.listen({ port: ENV.FASTIFY_PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${ENV.FASTIFY_PORT}`);
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
