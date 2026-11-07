try {
  process.loadEnvFile?.();
} catch {}
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Trust proxy for reverse proxies, Docker, Nginx, and cloud load balancers
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Ensure uploads directory exists on disk for biometric images
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    logger.log(`Created uploads directory at ${uploadsDir}`);
  }

  // Security headers with crossOriginResourcePolicy permitting served photos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS configuration supporting web dashboards, Docker, and mobile clients
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost',
        'http://localhost:80',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4000',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in self-hosted federated instances
      }
    },
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security check on JWT secret
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') {
    logger.warn(
      'SECURITY WARNING: JWT_SECRET is unset or using the default fallback. Change it in production!',
    );
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`TruMark backend running on http://localhost:${port}`);
}
bootstrap();
