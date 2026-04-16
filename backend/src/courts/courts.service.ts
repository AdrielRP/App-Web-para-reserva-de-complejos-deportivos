import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourtDto } from './dto/create-court.dto';

@Injectable()
export class CourtsService {
  constructor(private prisma: PrismaService) {}

  async availability(courtId: string, date: string, tz = 'America/Lima') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }

    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      select: { id: true, isActive: true },
    });
    if (!court) throw new BadRequestException('Court not found');
    if (!court.isActive) throw new BadRequestException('Court is not active');

    const localNoonUtc = fromZonedTime(`${date} 12:00:00`, tz);
    const iso = Number(formatInTimeZone(localNoonUtc, tz, 'i'));
    const dayIndex = iso % 7;

    const rules = await this.prisma.courtScheduleRule.findMany({
      where: { courtId, dayOfWeek: dayIndex, isActive: true },
      orderBy: { startMin: 'asc' },
      select: { startMin: true, endMin: true, slotMin: true },
    });

    if (rules.length === 0) {
      return { date, timezone: tz, courtId, slots: [] as any[] };
    }

    const dayStartUtc = fromZonedTime(`${date} 00:00:00`, tz);
    const dayEndUtc = fromZonedTime(`${date} 23:59:59.999`, tz);

    const bookings = await this.prisma.booking.findMany({
      where: {
        courtId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
      },
      select: { id: true, startAt: true, endAt: true },
    });

    const toHHmm = (mins: number) => {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const slots: Array<{
      startLocal: string;
      endLocal: string;
      startAt: string;
      endAt: string;
      available: boolean;
      bookingId: string | null;
    }> = [];

    for (const r of rules) {
      const slotMin = r.slotMin ?? 60;

      for (let m = r.startMin; m + slotMin <= r.endMin; m += slotMin) {
        const startLocal = toHHmm(m);
        const endLocal = toHHmm(m + slotMin);

        const startAt = fromZonedTime(`${date} ${startLocal}:00`, tz);
        const endAt = fromZonedTime(`${date} ${endLocal}:00`, tz);

        const overlap = bookings.find(
          (b) => b.startAt < endAt && b.endAt > startAt,
        );

        slots.push({
          startLocal,
          endLocal,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          available: !overlap,
          bookingId: overlap?.id ?? null,
        });
      }
    }

    return { date, timezone: tz, courtId, slots };
  }

  async create(ownerId: string, dto: CreateCourtDto) {
    const complex = await this.prisma.complex.findFirst({
      where: { id: dto.complexId, ownerId },
      select: { id: true },
    });
    if (!complex)
      throw new ForbiddenException('Complex not found or not owned by you');

    return this.prisma.court.create({
      data: {
        complexId: dto.complexId,
        name: dto.name,
        sport: dto.sport,
        pricePerHour: dto.pricePerHour,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async setWeeklyDefaultSchedule(
    ownerId: string,
    courtId: string,
    dto: { start: string; end: string; slotMin: number; replace?: boolean },
  ) {
    const replace = dto.replace ?? true;

    // Validar formato HH:mm
    const parseHHmm = (s: string) => {
      const m = /^(\d{2}):(\d{2})$/.exec(s);
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh < 0 || hh > 23) return null;
      if (mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };

    const startMin = parseHHmm(dto.start);
    const endMin = parseHHmm(dto.end);

    if (startMin === null || endMin === null) {
      throw new BadRequestException('start/end must be in HH:mm format');
    }
    if (endMin <= startMin) {
      throw new BadRequestException('end must be after start');
    }
    if (![30, 60].includes(dto.slotMin)) {
      throw new BadRequestException('slotMin must be 30 or 60');
    }
    if (endMin - startMin < dto.slotMin) {
      throw new BadRequestException('Schedule window is smaller than slotMin');
    }

    // Verificar que la cancha existe y pertenece a un complejo del owner
    const court = await this.prisma.court.findFirst({
      where: {
        id: courtId,
        complex: { ownerId },
      },
      select: { id: true },
    });

    if (!court) {
      throw new ForbiddenException('Court not found or not owned by you');
    }

    if (replace) {
      await this.prisma.courtScheduleRule.deleteMany({
        where: { courtId },
      });
    }

    // Crear 7 reglas: 0..6 (Sun..Sat)
    const data = Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      courtId,
      dayOfWeek,
      startMin,
      endMin,
      slotMin: dto.slotMin,
      isActive: true,
    }));

    await this.prisma.courtScheduleRule.createMany({ data });

    return {
      courtId,
      created: data.length,
      startMin,
      endMin,
      slotMin: dto.slotMin,
      replace,
    };
  }

  async listByComplex(complexId: string) {
    const exists = await this.prisma.complex.findUnique({
      where: { id: complexId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Complex not found');

    return this.prisma.court.findMany({
      where: { complexId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
