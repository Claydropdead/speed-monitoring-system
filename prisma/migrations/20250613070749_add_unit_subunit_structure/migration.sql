/*
  Warnings:

  - You are about to drop the column `name` on the `offices` table. All the data in the column will be lost.
  - Added the required column `unitOffice` to the `offices` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_offices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitOffice" TEXT NOT NULL,
    "subUnitOffice" TEXT,
    "location" TEXT NOT NULL,
    "isp" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "offices_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "offices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Migrate existing data: use the old 'name' field as 'unitOffice'
INSERT INTO "new_offices" ("id", "unitOffice", "subUnitOffice", "location", "isp", "description", "parentId", "createdAt", "updatedAt") 
SELECT "id", "name", NULL, "location", "isp", "description", NULL, "createdAt", "updatedAt" FROM "offices";
DROP TABLE "offices";
ALTER TABLE "new_offices" RENAME TO "offices";
CREATE UNIQUE INDEX "offices_unitOffice_subUnitOffice_key" ON "offices"("unitOffice", "subUnitOffice");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
