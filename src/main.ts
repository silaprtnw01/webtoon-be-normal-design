import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.corsOrigin ?? true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerBuilder = new DocumentBuilder()
    .setTitle('Webtoon Platform API')
    .setDescription('Backend API docs')
    .setVersion('0.1.0')
    .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie' });

  // Servers
  swaggerBuilder.addServer(`http://localhost:${config.port}`, 'Local Dev');
  if (config.publicBaseUrl) {
    swaggerBuilder.addServer(config.publicBaseUrl, 'Public Base URL');
  }

  const swaggerConfig = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.port);
  console.log(`API on http://localhost:${config.port} (docs: /docs)`);
}
void bootstrap();
