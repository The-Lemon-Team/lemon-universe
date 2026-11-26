import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { McpService } from './mcp/mcp.service';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
  });
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, x-api-key, x-profile-id, Mcp-Session-Id, Accept',
    exposedHeaders: 'Mcp-Session-Id',
  });
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  const swaggerDoc = setupSwagger(app);
  app.get(McpService).syncWithOpenApi(swaggerDoc);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`🍋🌌 Lemon Universe NestJS API listening on http://localhost:${port}/api`);
  console.log(`📘 Swagger UI: http://localhost:${port}/api/docs (OpenAPI JSON: /api/docs-json)`);
  console.log(`🔌 TimeLines MCP (Streamable HTTP): http://localhost:${port}/mcp`);
}

void bootstrap();
