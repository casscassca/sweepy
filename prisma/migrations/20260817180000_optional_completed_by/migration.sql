-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompletionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompletionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionLog_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CompletionLog" ("id", "taskId", "userId", "completedById", "completedAt")
SELECT "id", "taskId", "userId", "completedById", "completedAt" FROM "CompletionLog";
DROP TABLE "CompletionLog";
ALTER TABLE "new_CompletionLog" RENAME TO "CompletionLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
