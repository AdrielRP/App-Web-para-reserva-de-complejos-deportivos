import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { SetWeeklyScheduleDto } from './dto/set-weekly-schedule.dto';

@Controller()
export class CourtsController {
  constructor(private courts: CourtsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('courts')
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateCourtDto) {
    return this.courts.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('courts/:courtId/schedule/weekly-default')
  setWeeklySchedule(
    @Req() req: { user: { sub: string } },
    @Param('courtId') courtId: string,
    @Body() dto: SetWeeklyScheduleDto,
  ) {
    return this.courts.setWeeklyDefaultSchedule(req.user.sub, courtId, dto);
  }

  @Get('complexes/:complexId/courts')
  list(@Param('complexId') complexId: string) {
    return this.courts.listByComplex(complexId);
  }

  @Get('courts/:courtId/availability')
  availability(
    @Param('courtId') courtId: string,
    @Query('date') date: string,
    @Query('durationMin') durationMin?: string,
  ) {
    const requestedDurationMin =
      durationMin === undefined ? undefined : Number(durationMin);
    return this.courts.availability(
      courtId,
      date,
      'America/Lima',
      requestedDurationMin,
    );
  }
}
