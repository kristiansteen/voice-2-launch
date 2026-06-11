import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import config from './config';
import logger from './utils/logger';
import prisma from './config/database';

// Import routes
import authRoutes from './routes/auth.routes';
import boardRoutes from './routes/board.routes';
import portfolioRoutes from './routes/portfolio.routes';
import subscriptionRoutes from './routes/subscription.routes';
import adminRoutes from './routes/admin.routes';
import eventlogRoutes from './routes/eventlog.routes';
import leadRoutes from './routes/lead.routes';
import diagramRoutes from './routes/diagram.routes';
import flowRoutes from './routes/flow.routes';
import cronRoutes from './routes/cron.routes';
import unsubscribeRoutes from './routes/unsubscribe.routes';

import { configureGoogleStrategy } from './auth/googleAuth';

// Initialize Passport Strategies
configureGoogleStrategy();

const app: Express = express();

// Trust proxy (for Railway, Render, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    const allowedOrigins = config.frontend.allowedOrigins.map(o => o.toLowerCase());
    const lowerOrigin = origin.toLowerCase().replace(/\/+$/, '');

    // Check main list, wildcards, vercel.app subdomains, same-host (Swagger UI),
    // or any host on Vite's dev ports (5173/5174) for local network access
    const selfOrigin = `http://localhost:${config.port}`;
    const isViteDevOrigin = lowerOrigin.endsWith(':5173') || lowerOrigin.endsWith(':5174');
    if (
      allowedOrigins.includes(lowerOrigin) ||
      allowedOrigins.includes('*') ||
      lowerOrigin === config.frontend.url.toLowerCase() ||
      lowerOrigin.endsWith('.vercel.app') ||
      lowerOrigin === selfOrigin.toLowerCase() ||
      isViteDevOrigin
    ) {
      callback(null, true);
    } else {
      logger.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Request logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'vimpl API is running', version: '1.0.0', health: '/health' });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/boards', boardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/portfolio', portfolioRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/boards/:boardId/eventlog', eventlogRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/diagrams', diagramRoutes);
app.use('/api/v1/flows', flowRoutes);
app.use('/api/v1/cron', cronRoutes);
app.use('/api/v1/unsubscribe', unsubscribeRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message = config.nodeEnv === 'development' ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const PORT = config.port;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${config.nodeEnv} mode`);
      logger.info(`📍 API available at http://localhost:${PORT}/api/v1`);
      logger.info(`💚 Health check at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only bind to a port when running locally - Vercel handles this in serverless
if (!process.env.VERCEL) {
  startServer();
}

export default app;
