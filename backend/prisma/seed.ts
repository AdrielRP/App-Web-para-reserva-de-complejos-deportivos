import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEV_OWNER = {
  email: 'owner.dev@pichangaya.local',
  password: 'Owner123!',
  fullName: 'Owner Dev',
  role: Role.OWNER,
} as const;

const DEV_USER = {
  email: 'user.dev@pichangaya.local',
  password: 'User123!',
  fullName: 'User Dev',
  role: Role.USER,
} as const;

async function upsertUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      password: passwordHash,
      fullName: input.fullName,
      role: input.role,
    },
    update: {
      password: passwordHash,
      fullName: input.fullName,
      role: input.role,
    },
  });
}

async function main() {
  const owner = await upsertUser(DEV_OWNER);
  await upsertUser(DEV_USER);

  const complexName = 'Complejo Demo Lima';
  const complex =
    (await prisma.complex.findFirst({
      where: { ownerId: owner.id, name: complexName },
      select: { id: true },
    })) ??
    (await prisma.complex.create({
      data: {
        ownerId: owner.id,
        name: complexName,
        district: 'Miraflores',
        address: 'Av. Demo 123',
        phone: '999999999',
        isActive: true,
      },
      select: { id: true },
    }));

  const courtName = 'Cancha 1 - Fútbol';
  const court =
    (await prisma.court.findFirst({
      where: { complexId: complex.id, name: courtName },
      select: { id: true },
    })) ??
    (await prisma.court.create({
      data: {
        complexId: complex.id,
        name: courtName,
        sport: 'FUTBOL',
        pricePerHour: 100,
        isActive: true,
      },
      select: { id: true },
    }));

  await prisma.courtScheduleRule.deleteMany({ where: { courtId: court.id } });
  await prisma.courtScheduleRule.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      courtId: court.id,
      dayOfWeek,
      startMin: 12 * 60,
      endMin: 22 * 60,
      slotMin: 60,
      isActive: true,
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
