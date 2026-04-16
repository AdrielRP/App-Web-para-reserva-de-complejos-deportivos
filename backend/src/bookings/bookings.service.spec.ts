import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService.pay', () => {
  const prismaMock = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsService(prismaMock as never);
  });

  it('pays and confirms booking with simulated payment', async () => {
    prismaMock.booking.findUnique
      .mockResolvedValueOnce({
        id: 'booking-1',
        userId: 'user-1',
        status: 'PENDING',
        priceSubtotal: 100,
        commissionAmt: 10,
      })
      .mockResolvedValueOnce({
        id: 'booking-1',
        status: 'CONFIRMED',
        totalPaid: 110,
        payment: { status: 'PAID', provider: 'SIMULATED', amount: 110 },
      });
    prismaMock.payment.upsert.mockReturnValue({} as never);
    prismaMock.booking.update.mockReturnValue({} as never);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await service.pay('user-1', 'booking-1', 'ref-123');

    expect(prismaMock.payment.upsert).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      create: {
        bookingId: 'booking-1',
        provider: 'SIMULATED',
        status: 'PAID',
        amount: 110,
        reference: 'ref-123',
      },
      update: {
        provider: 'SIMULATED',
        status: 'PAID',
        amount: 110,
        reference: 'ref-123',
      },
    });
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { totalPaid: 110, status: 'CONFIRMED' },
    });
    expect(result).toMatchObject({
      id: 'booking-1',
      status: 'CONFIRMED',
      totalPaid: 110,
      payment: { status: 'PAID', provider: 'SIMULATED', amount: 110 },
    });
  });

  it('rejects paying cancelled booking', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: 'CANCELLED',
      priceSubtotal: 100,
      commissionAmt: 10,
    });

    await expect(service.pay('user-1', 'booking-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects paying another user booking', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'other-user',
      status: 'PENDING',
      priceSubtotal: 100,
      commissionAmt: 10,
    });

    await expect(service.pay('user-1', 'booking-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('BookingsService.owner', () => {
  const prismaMock = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsService(prismaMock as never);
  });

  it('lists only owner bookings with filters', async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);

    await service.ownerBookings('owner-1', {
      complexId: 'complex-1',
      courtId: 'court-1',
      district: 'miraflores',
      status: 'PENDING',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });

    expect(prismaMock.booking.findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects owner cancellation for someone else complex', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING',
      endAt: new Date(Date.now() + 60 * 60 * 1000),
      court: {
        complex: {
          ownerId: 'owner-2',
        },
      },
    });

    await expect(
      service.ownerCancel('owner-1', 'booking-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates booking to cancelled for owner', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
      endAt: new Date(Date.now() + 60 * 60 * 1000),
      court: {
        complex: {
          ownerId: 'owner-1',
        },
      },
    });
    prismaMock.booking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'CANCELLED',
    });

    const result = await service.ownerCancel('owner-1', 'booking-1');

    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'CANCELLED' },
    });
    expect(result).toMatchObject({ id: 'booking-1', status: 'CANCELLED' });
  });
});
