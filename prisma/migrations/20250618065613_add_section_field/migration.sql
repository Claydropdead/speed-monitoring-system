/*
  Warnings:

  - You are about to drop the column `address` on the `offices` table. All the data in the column will be lost.
  - You are about to drop the column `officeCode` on the `offices` table. All the data in the column will be lost.
  - You are about to drop the column `officeStatus` on the `offices` table. All the data in the column will be lost.
  - You are about to drop the column `officerInCharge` on the `offices` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `offices` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_offices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitOffice" TEXT NOT NULL,
    "subUnitOffice" TEXT,
    "location" TEXT NOT NULL,
    "section" TEXT,
    "isp" TEXT NOT NULL,
    "isps" TEXT,
    "sectionISPs" TEXT,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "offices_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "offices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_offices" ("createdAt", "description", "id", "isp", "isps", "location", "parentId", "subUnitOffice", "unitOffice", "updatedAt") SELECT "createdAt", "description", "id", "isp", "isps", "location", "parentId", "subUnitOffice", "unitOffice", "updatedAt" FROM "offices";
DROP TABLE "offices";
ALTER TABLE "new_offices" RENAME TO "offices";
CREATE UNIQUE INDEX "offices_unitOffice_subUnitOffice_key" ON "offices"("unitOffice", "subUnitOffice");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
