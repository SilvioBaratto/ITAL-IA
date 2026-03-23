import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { HealthModule } from './modules/health/health.module';
import { TestModule } from './modules/test/test.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { AuthModule } from './modules/auth/auth.module';
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { QdrantModule } from './modules/qdrant/qdrant.module';
import { SupabaseAuthGuard } from './modules/auth/auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    PrismaModule,

    // Vector search
    QdrantModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    HealthModule,
    TestModule,
    ChatbotModule,
    AuthModule,
    ItineraryModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*path');
  }
}
