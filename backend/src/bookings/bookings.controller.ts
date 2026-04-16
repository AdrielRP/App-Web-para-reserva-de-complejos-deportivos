import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingsService } from './bookings.service';
import { PayBookingDto } from './dto/pay-booking.dto';
import { OwnerBookingsQueryDto } from './dto/owner-bookings-query.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateBookingDto) {
    return this.bookings.create({
      userId: req.user.sub,
      courtId: dto.courtId,
      startAtIso: dto.startAt,
      date: dto.date,
      startLocal: dto.startLocal,
      durationMin: dto.durationMin ?? 60,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get('mine')
  mine(@Req() req: { user: { sub: string } }) {
    return this.bookings.mine(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Patch(':id/cancel')
  cancel(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.bookings.cancel(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Get('owner')
  ownerBookings(
    @Req() req: { user: { sub: string } },
    @Query() query: OwnerBookingsQueryDto,
  ) {
    return this.bookings.ownerBookings(req.user.sub, {
      complexId: query.complexId,
      courtId: query.courtId,
      district: query.district,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: query.status as BookingStatus | undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Patch(':id/owner-cancel')
  ownerCancel(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.bookings.ownerCancel(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Post(':id/pay')
  pay(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: PayBookingDto,
  ) {
    return this.bookings.pay(req.user.sub, id, dto.reference);
  }
}
