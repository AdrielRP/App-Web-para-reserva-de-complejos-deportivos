import { fromZonedTime } from 'date-fns-tz';
import { CourtsService } from './courts.service';

describe('CourtsService.availability', () => {
  const tz = 'America/Lima';
  const date = '2026-04-20';

  const prismaMock = {
    court: { findUnique: jest.fn() },
    courtScheduleRule: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };

  let service: CourtsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CourtsService(prismaMock as never);
  });

  it('returns durationOptionsMin and BOOKED reason when overlap exists', async () => {
    prismaMock.court.findUnique.mockResolvedValue({
      id: 'court-1',
      isActive: true,
    });
    prismaMock.courtScheduleRule.findMany.mockResolvedValue([
      { startMin: 12 * 60, endMin: 15 * 60, slotMin: 60 },
    ]);
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        startAt: fromZonedTime(`${date} 13:00:00`, tz),
        endAt: fromZonedTime(`${date} 14:00:00`, tz),
      },
    ]);

    const result = await service.availability('court-1', date, tz);

    expect(result.durationsAllowedMin).toEqual([60, 90, 120]);
    expect(result.slotMin).toBe(60);

    const slot12 = result.slots.find((s) => s.startLocal === '12:00');
    const slot13 = result.slots.find((s) => s.startLocal === '13:00');
    const slot14 = result.slots.find((s) => s.startLocal === '14:00');

    expect(slot12).toMatchObject({
      available: true,
      durationOptionsMin: [60],
      reason: undefined,
      bookingId: null,
    });
    expect(slot13).toMatchObject({
      available: false,
      durationOptionsMin: [],
      reason: 'BOOKED',
      bookingId: 'booking-1',
    });
    expect(slot14).toMatchObject({
      available: true,
      durationOptionsMin: [60],
      reason: undefined,
      bookingId: null,
    });
  });

  it('marks OUTSIDE_SCHEDULE when requested duration does not fit', async () => {
    prismaMock.court.findUnique.mockResolvedValue({
      id: 'court-1',
      isActive: true,
    });
    prismaMock.courtScheduleRule.findMany.mockResolvedValue([
      { startMin: 12 * 60, endMin: 14 * 60, slotMin: 30 },
    ]);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const result = await service.availability('court-1', date, tz, 60);
    const slot1330 = result.slots.find((s) => s.startLocal === '13:30');

    expect(slot1330).toMatchObject({
      startMin: 13 * 60 + 30,
      endMin: 14 * 60,
      available: false,
      reason: 'OUTSIDE_SCHEDULE',
      bookingId: null,
      durationOptionsMin: [],
    });
  });
});
