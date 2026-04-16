-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('MANAGE_COURTS', 'MANAGE_SCHEDULE', 'VIEW_BOOKINGS', 'MANAGE_BOOKINGS', 'VIEW_PAYMENTS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complex" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMembership" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "staffMembershipId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT 'FUTBOL',
    "pricePerHour" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtScheduleRule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "slotMin" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CourtScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "priceSubtotal" INTEGER NOT NULL,
    "commissionPct" INTEGER NOT NULL,
    "commissionAmt" INTEGER NOT NULL,
    "totalPaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "reference" TEXT,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Complex_ownerId_idx" ON "Complex"("ownerId");

-- CreateIndex
CREATE INDEX "Complex_district_idx" ON "Complex"("district");

-- CreateIndex
CREATE INDEX "StaffMembership_userId_idx" ON "StaffMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMembership_complexId_userId_key" ON "StaffMembership"("complexId", "userId");

-- CreateIndex
CREATE INDEX "StaffPermission_staffMembershipId_idx" ON "StaffPermission"("staffMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_staffMembershipId_permission_key" ON "StaffPermission"("staffMembershipId", "permission");

-- CreateIndex
CREATE INDEX "Court_complexId_idx" ON "Court"("complexId");

-- CreateIndex
CREATE INDEX "CourtScheduleRule_courtId_dayOfWeek_idx" ON "CourtScheduleRule"("courtId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Booking_courtId_startAt_endAt_idx" ON "Booking"("courtId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- AddForeignKey
ALTER TABLE "Complex" ADD CONSTRAINT "Complex_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_staffMembershipId_fkey" FOREIGN KEY ("staffMembershipId") REFERENCES "StaffMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtScheduleRule" ADD CONSTRAINT "CourtScheduleRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
