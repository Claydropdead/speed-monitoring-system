/*
  Warnings:

  - Added the required column `isp` to the `speed_tests` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_speed_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officeId" TEXT NOT NULL,
    "download" REAL NOT NULL,
    "upload" REAL NOT NULL,
    "ping" REAL NOT NULL,
    "jitter" REAL,
    "packetLoss" REAL,
    "isp" TEXT NOT NULL,
    "serverId" TEXT,
    "serverName" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" TEXT,
    CONSTRAINT "speed_tests_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_speed_tests" ("download", "id", "jitter", "officeId", "packetLoss", "ping", "rawData", "serverId", "serverName", "timestamp", "upload") SELECT "download", "id", "jitter", "officeId", "packetLoss", "ping", "rawData", "serverId", "serverName", "timestamp", "upload" FROM "speed_tests";
DROP TABLE "speed_tests";
ALTER TABLE "new_speed_tests" RENAME TO "speed_tests";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
