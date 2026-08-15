-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");
