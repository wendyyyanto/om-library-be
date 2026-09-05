import { NestFactory } from '@nestjs/core';
import { assertNoUnexpectedPublicRoutes } from './commons/PublicRouteAudit';
import { AppModule } from './modules/AppModule';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  assertNoUnexpectedPublicRoutes(app);
  app.setGlobalPrefix('v1');
  app.enableCors();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`🚀 NestJS server running on port ${port}`);
}

void bootstrap();
