import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize services
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  errorFormat: 'pretty'
});

// Redis client setup (optional)
let redis: any = null;
let redisAvailable = false;

// Helper functions for optional Redis usage
export const cache = {
  get: async (key: string) => {
    if (!redisAvailable || !redis) return null;
    try {
      return await redis.get(key);
    } catch (err: any) {
      logger.warn('Redis get failed:', err);
      return null;
    }
  },
  set: async (key: string, value: string, ttl?: number) => {
    if (!redisAvailable || !redis) return false;
    try {
      if (ttl) {
        await redis.setex(key, ttl, value);
      } else {
        await redis.set(key, value);
      }
      return true;
    } catch (err: any) {
      logger.warn('Redis set failed:', err);
      return false;
    }
  },
  del: async (key: string) => {
    if (!redisAvailable || !redis) return false;
    try {
      await redis.del(key);
      return true;
    } catch (err: any) {
      logger.warn('Redis delete failed:', err);
      return false;
    }
  },
  isAvailable: () => redisAvailable
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Express app setup
const app = express();

// Trust proxy for proper IP handling behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.twilio.com"],
      connectSrc: ["'self'", "*.twilio.com", "wss://eventgw.twilio.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      api: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      database: { status: 'checking' } as any,
      redis: { status: 'checking' } as any
    }
  };
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = { status: 'healthy' };
  } catch (error) {
    checks.checks.database = { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    logger.error('Database health check failed:', error);
  }
  
  if (redis && redisAvailable) {
    try {
      await redis.ping();
      checks.checks.redis = { status: 'healthy' };
    } catch (error) {
      checks.checks.redis = { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      logger.error('Redis health check failed:', error);
    }
  } else {
    checks.checks.redis = { 
      status: 'disabled', 
      message: 'Redis not configured or unavailable' 
    };
  }
  
  const allHealthy = Object.values(checks.checks)
    .every((check: any) => check.status === 'healthy' || check.status === 'disabled');
  
  checks.status = allHealthy ? 'healthy' : 'degraded';
  
  res.status(allHealthy ? 200 : 503).json(checks);
});

// Basic API info endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Dialler System API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    }
  });
});

// Import routes
import authRoutes from './routes/auth.routes';
import queueRoutes from './routes/queue.routes';
import callRoutes from './routes/call.routes';
import smsRoutes from './routes/sms.routes';
import magicLinkRoutes from './routes/magic-link.routes';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/magic-links', magicLinkRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    ip: req.ip
  });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');
  
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
  
  if (redis && redisAvailable) {
    try {
      await redis.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Initialize Redis connection (optional)
async function initializeRedis() {
  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'development') {
    logger.info('Redis URL not provided, running without Redis cache');
    return;
  }
  
  try {
    redis = createClient({ 
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) return false; // Stop retrying after 2 attempts
          return Math.min(retries * 50, 500);
        }
      }
    });

    redis.on('error', (err: any) => {
      logger.warn('Redis connection error (continuing without cache):', err.message);
      redisAvailable = false;
    });

    redis.on('connect', () => {
      logger.info('Redis connected successfully');
      redisAvailable = true;
    });

    // Connect with timeout
    const connectPromise = redis.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    redisAvailable = true;
    logger.info('Redis initialized successfully');
    
  } catch (err: any) {
    logger.warn('Redis initialization failed, continuing without cache:', err.message);
    redis = null;
    redisAvailable = false;
  }
}

// Initialize Redis on startup
initializeRedis();

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Dialler API server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });
}

export default app; 