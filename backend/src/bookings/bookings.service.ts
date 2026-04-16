import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ALLOWED_BOOKING_DURATIONS_MIN } from './bookings.constants';

@Injectable()
export class BookingsService {
  private COMMISSION_PCT = 10; // MVP
  private TZ = 'America/Lima';

  private ALLOWED_DURATIONS = new Set<number>(ALLOWED_BOOKING_DURATIONS_MIN);
  private MAX_DURATION_MIN = 120;

  constructor(private prisma: PrismaService) {}

  private parseStartAt(input: {
    startAtIso?: string;
    date?: string;
    startLocal?: string;
  }): Date {
    // Preferimos hora local si viene completa
    if (input.date && input.startLocal) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new BadRequestException('date must be YYYY-MM-DD');
      }
      if (!/^(\d{2}):(\d{2})$/.test(input.startLocal)) {
        throw new BadRequestException('startLocal must be HH:mm');
      }
      // Construye Date UTC a partir de fecha+hora en zona Lima
      return fromZonedTime(`${input.date} ${input.startLocal}:00`, this.TZ);
    }

    // Si no, usamos startAt ISO (compatibilidad)
    if (!input.startAtIso) {
      throw new BadRequestException(
        'Provide either startAt or (date + startLocal)',
      );
    }

    const d = new Date(input.startAtIso);
    if (isNaN(d.getTime()))
      throw new BadRequestException('Invalid startAt date');
    return d;
  }

  async create(params: {
    userId: string;
    courtId: string;
    startAtIso?: string;
    date?: string;
    startLocal?: string;
    durationMin?: number;
  }) {
    const durationMin = params.durationMin ?? 60;

    if (!Number.isInteger(durationMin) || durationMin <= 0) {
      throw new BadRequestException('durationMin must be a positive integer');
    }
    if (durationMin > this.MAX_DURATION_MIN) {
      throw new BadRequestException(
        `Max duration is ${this.MAX_DURATION_MIN} minutes`,
      );
    }
    if (!this.ALLOWED_DURATIONS.has(durationMin)) {
      throw new BadRequestException(
        `Allowed durations: ${Array.from(this.ALLOWED_DURATIONS).join(', ')}`,
      );
    }

    const startAt = this.parseStartAt({
      startAtIso: params.startAtIso,
      date: params.date,
      startLocal: params.startLocal,
    });

    const court = await this.prisma.court.findUnique({
      where: { id: params.courtId },
      select: { id: true, isActive: true, pricePerHour: true },
    });
    if (!court) throw new NotFoundException('Court not found');
    if (!court.isActive) throw new BadRequestException('Court is not active');

    // Día local (Lima) según startAt
    const localDate = formatInTimeZone(startAt, this.TZ, 'yyyy-MM-dd');

    // 0=Sun..6=Sat
    const iso = Number(formatInTimeZone(startAt, this.TZ, 'i')); // 1..7
    const dayIndex = iso % 7;

    const rules = await this.prisma.courtScheduleRule.findMany({
      where: { courtId: params.courtId, dayOfWeek: dayIndex, isActive: true },
      orderBy: { startMin: 'asc' },
      select: { startMin: true, endMin: true, slotMin: true },
    });

    if (rules.length === 0) {
      throw new BadRequestException('Court has no schedule rules for this day');
    }

    // startAt -> minutos desde 00:00 en Lima
    const hh = Number(formatInTimeZone(startAt, this.TZ, 'H'));
    const mm = Number(formatInTimeZone(startAt, this.TZ, 'm'));
    const startMinLocal = hh * 60 + mm;

    const rule = rules.find(
      (r) => startMinLocal >= r.startMin && startMinLocal < r.endMin,
    );
    if (!rule) {
      throw new BadRequestException(
        'startAt is outside of court working hours',
      );
    }

    const slotMin = rule.slotMin ?? 60;

    if (startMinLocal % slotMin !== 0) {
      throw new BadRequestException(
        `startAt must align to slotMin=${slotMin} minutes`,
      );
    }

    const endMinLocal = startMinLocal + durationMin;
    if (endMinLocal > rule.endMin) {
      throw new BadRequestException('Booking exceeds court working hours');
    }

    const endHH = String(Math.floor(endMinLocal / 60)).padStart(2, '0');
    const endMM = String(endMinLocal % 60).padStart(2, '0');
    const endAt = fromZonedTime(`${localDate} ${endHH}:${endMM}:00`, this.TZ);

    const overlap = await this.prisma.booking.findFirst({
      where: {
        courtId: params.courtId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });

    if (overlap)
      throw new BadRequestException('This time slot is already booked');

    const priceSubtotal = Math.round(court.pricePerHour * (durationMin / 60));
    const commissionPct = this.COMMISSION_PCT;
    const commissionAmt = Math.round((priceSubtotal * commissionPct) / 100);

    return this.prisma.booking.create({
      data: {
        courtId: params.courtId,
        userId: params.userId,
        startAt,
        endAt,
        status: 'PENDING',
        priceSubtotal,
        commissionPct,
        commissionAmt,
        totalPaid: 0,
      },
    });
  }

  mine(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        court: {
          select: {
            id: true,
            name: true,
            sport: true,
            pricePerHour: true,
            complex: {
              select: { id: true, name: true, district: true, address: true },
            },
          },
        },
      },
    });
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId)
      throw new ForbiddenException('Not your booking');

    if (booking.status === 'CANCELLED') return booking;

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  }

  async pay(userId: string, bookingId: string, reference?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        priceSubtotal: true,
        commissionAmt: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId)
      throw new ForbiddenException('Not your booking');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot pay a cancelled booking');
    }

    const amount = booking.priceSubtotal + booking.commissionAmt;

    await this.prisma.$transaction([
      this.prisma.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          provider: 'SIMULATED',
          status: 'PAID',
          amount,
          reference,
        },
        update: {
          provider: 'SIMULATED',
          status: 'PAID',
          amount,
          reference,
        },
      }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          totalPaid: amount,
          status: 'CONFIRMED',
        },
      }),
    ]);

    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
  }
}
