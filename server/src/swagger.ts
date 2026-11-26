import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Builds the canonical OpenAPI 3.0 specification for Lemon Universe API & MCP sync. */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Lemon Universe — TimeLines & Actors API')
    .setDescription(
      'REST API для TimeLine-досок, заметок, кросс-ссылок, персонажей и профилей Lemon Universe. ' +
        'OpenAPI-схемы синхронизированы с MCP-сервером (/mcp).',
    )
    .setVersion('0.3.0')
    .addTag('timelines', 'TimeLine-доски, заметки, кросс-ссылки и сводки агентов')
    .addTag('actors', 'Персонажи Lemon Universe и статистика')
    .addTag('profiles', 'Профили игроков и AI-агентов')
    .addTag('health', 'Статус сервиса и подключений')
    .addTag('chronicle', 'Machine-facing Chronicle API (Projectarium)')
    .addTag('projectarium', 'Управление токенами связи Projectarium <-> TimeLines')
    .addTag('flows', 'Потоки Core Combinator')
    .addTag('seasons', 'Интеграция с Lemon Seasons & Media Hub')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Mounts Swagger UI at /api/docs and OpenAPI JSON at /api/docs-json. */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
  return document;
}
