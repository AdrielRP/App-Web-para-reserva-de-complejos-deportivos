import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ComplexesModule } from './complexes/complexes.module';
import { CourtsModule } from './courts/courts.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ComplexesModule,
    CourtsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
