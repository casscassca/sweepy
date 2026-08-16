-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roomId" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "frequencyDays" INTEGER NOT NULL DEFAULT 7,
    "allowedDays" TEXT,
    "lastDoneAt" DATETIME,
    "oneOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id", "name", "roomId", "difficulty", "frequencyDays", "allowedDays", "lastDoneAt", "createdAt")
SELECT "id", "name", "roomId", "difficulty", "frequencyDays", "allowedDays", "lastDoneAt", "createdAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
