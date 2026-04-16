import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ALLOWED_BOOKING_DURATIONS_MIN } from './bookings.constants';

@Injectable()
export class BookingsService {
  private COMMISSION_PCT = 10; // MVP
  private TZ = 'America/Lima';
  private MAX_PAYMENT_REFERENCE_LENGTH = 120;

  private ALLOWED_DURATIONS = new Set<number>(ALLOWED_BOOKING_DURATIONS_MIN);
  private MAX_DURATION_MIN = 120;

  constructor(private prisma: PrismaService) {}

  private parseMineScope(scope?: string): 'active' | 'history' | undefined {
    if (scope === undefined) return undefined;
    if (scope === 'active' || scope === 'history') return scope;

    throw new BadRequestException('scope must be active or history');
  }

  private parseDateFilterBoundary(
    value: string,
    boundary: 'start' | 'end',
  ): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const time = boundary === 'start' ? '00:00:00' : '23:59:59.999';
      return fromZonedTime(`${value} ${time}`, this.TZ);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${boundary === 'start' ? 'dateFrom' : 'dateTo'} must be a valid date`,
      );
    }

    return parsed;
  }

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

  private validatePaymentReference(reference?: string): string | undefined {
    if (reference === undefined) return undefined;

    const normalizedReference = reference.trim();
    if (
      normalizedReference.length === 0 ||
      normalizedReference.length > this.MAX_PAYMENT_REFERENCE_LENGTH
    ) {
      throw new BadRequestException(
        `reference must be 1 to ${this.MAX_PAYMENT_REFERENCE_LENGTH} characters when provided`,
      );
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedReference)) {
      throw new BadRequestException(
        'reference can only include letters, numbers, hyphen and underscore',
      );
    }

    return normalizedReference;
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

  async mine(userId: string, scope?: string) {
    const parsedScope = this.parseMineScope(scope);
    const now = new Date();

    const where =
      parsedScope === 'active'
        ? {
            userId,
            status: { in: ['PENDING', 'CONFIRMED'] as BookingStatus[] },
            endAt: { gt: now },
          }
        : parsedScope === 'history'
          ? {
              userId,
              OR: [{ status: 'CANCELLED' as BookingStatus }, { endAt: { lte: now } }],
            }
          : { userId };

    return this.prisma.booking.findMany({
      where,
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

  ownerBookings(
    ownerId: string,
    filters: {
      complexId?: string;
      courtId?: string;
      district?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: BookingStatus;
    },
  ) {
    if (
      filters.status !== undefined &&
      !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(filters.status)
    ) {
      throw new BadRequestException(
        'status must be PENDING, CONFIRMED or CANCELLED',
      );
    }

    const startAtFilter: { gte?: Date; lte?: Date } = {};
    if (filters.dateFrom) {
      startAtFilter.gte = this.parseDateFilterBoundary(
        filters.dateFrom,
        'start',
      );
    }
    if (filters.dateTo) {
      startAtFilter.lte = this.parseDateFilterBoundary(filters.dateTo, 'end');
    }
    if (
      startAtFilter.gte &&
      startAtFilter.lte &&
      startAtFilter.gte > startAtFilter.lte
    ) {
      throw new BadRequestException(
        'dateFrom must be before or equal to dateTo',
      );
    }

    const district = filters.district?.trim();

    return this.prisma.booking.findMany({
      where: {
        status: filters.status,
        courtId: filters.courtId,
        ...(Object.keys(startAtFilter).length > 0
          ? { startAt: startAtFilter }
          : {}),
        court: {
          complex: {
            ownerId,
            id: filters.complexId,
            district: district
              ? {
                  equals: district,
                  mode: 'insensitive',
                }
              : undefined,
          },
        },
      },
      orderBy: { startAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        court: {
          select: {
            id: true,
            name: true,
            sport: true,
            complex: {
              select: {
                id: true,
                name: true,
                district: true,
              },
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

  async ownerCancel(ownerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        endAt: true,
        court: {
          select: {
            complex: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.court.complex.ownerId !== ownerId) {
      throw new ForbiddenException('Booking does not belong to your complexes');
    }

    if (booking.status === 'CANCELLED') return booking;
    if (booking.endAt <= new Date()) {
      throw new BadRequestException('Cannot cancel a past booking');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  }

  async pay(userId: string, bookingId: string, reference?: string) {
    // MVP simulated payment: upsert payment and confirm booking in one transaction.
    const validatedReference = this.validatePaymentReference(reference);

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
          reference: validatedReference,
        },
        update: {
          provider: 'SIMULATED',
          status: 'PAID',
          amount,
          reference: validatedReference,
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
