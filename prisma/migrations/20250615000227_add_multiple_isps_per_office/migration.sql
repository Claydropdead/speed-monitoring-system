/*
  Warnings:

  - A unique constraint covering the columns `[officeId,isp,timeSlot]` on the table `test_schedules` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "test_schedules_officeId_timeSlot_key";

-- AlterTable
ALTER TABLE "offices" ADD COLUMN "isps" TEXT;

-- AlterTable
ALTER TABLE "test_schedules" ADD COLUMN "isp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "test_schedules_officeId_isp_timeSlot_key" ON "test_schedules"("officeId", "isp", "timeSlot");
