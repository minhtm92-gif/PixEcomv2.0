import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TimingInterceptor } from "./common/interceptors/timing.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix("api");

  // WS3: Global exception filter — normalised error shape, no stack leak
  app.useGlobalFilters(new HttpExceptionFilter());

  // WS5: Timing interceptor — X-Response-Time-Ms header + slow request WARN
  app.useGlobalInterceptors(new TimingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`PixEcom API running on port ${port} [${process.env.NODE_ENV}]`);
}

bootstrap();
