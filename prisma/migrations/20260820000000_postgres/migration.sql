-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏠',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomId" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "frequencyDays" INTEGER NOT NULL DEFAULT 7,
    "allowedDays" TEXT,
    "lastDoneAt" TIMESTAMP(3),
    "oneOff" BOOLEAN NOT NULL DEFAULT false,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "dueOnly" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "addonName" TEXT NOT NULL DEFAULT '',
    "addonFrequencyDays" INTEGER NOT NULL DEFAULT 0,
    "addonPoints" INTEGER NOT NULL DEFAULT 1,
    "addonLastDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignableUser" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskAssignableUser_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "haNotifyTarget" TEXT NOT NULL DEFAULT '',
    "dailyCapacity" INTEGER NOT NULL DEFAULT 6,
    "dailyTaskLimit" INTEGER NOT NULL DEFAULT 6,
    "weekdayCapacities" TEXT NOT NULL DEFAULT '',
    "weekdayTaskLimits" TEXT NOT NULL DEFAULT '',
    "weekendShare" BOOLEAN NOT NULL DEFAULT true,
    "weekendCapacity" INTEGER NOT NULL DEFAULT 6,
    "weekendTaskLimit" INTEGER NOT NULL DEFAULT 4,
    "notifyTime" TEXT NOT NULL DEFAULT '08:00',
    "nudgeTime" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordHash" TEXT,
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "notifyTags" TEXT NOT NULL DEFAULT '',
    "vacationOn" BOOLEAN NOT NULL DEFAULT false,
    "vacationStart" TEXT NOT NULL DEFAULT '',
    "vacationEnd" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAssignment" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "remindAt" TIMESTAMP(3),
    "held" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "haUrl" TEXT NOT NULL DEFAULT '',
    "haToken" TEXT NOT NULL DEFAULT '',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "sessionSecret" TEXT NOT NULL DEFAULT '',
    "weekendShare" BOOLEAN NOT NULL DEFAULT true,
    "weekendCapacity" INTEGER NOT NULL DEFAULT 6,
    "weekendTaskLimit" INTEGER NOT NULL DEFAULT 4,
    "houseVacation" BOOLEAN NOT NULL DEFAULT false,
    "houseVacationStart" TEXT NOT NULL DEFAULT '',
    "houseVacationEnd" TEXT NOT NULL DEFAULT '',
    "pauseDirtiness" BOOLEAN NOT NULL DEFAULT false,
    "dirtFrozenOn" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAssignment_date_idx" ON "DailyAssignment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAssignment_date_taskId_key" ON "DailyAssignment"("date", "taskId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignableUser" ADD CONSTRAINT "TaskAssignableUser_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignableUser" ADD CONSTRAINT "TaskAssignableUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionLog" ADD CONSTRAINT "CompletionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionLog" ADD CONSTRAINT "CompletionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionLog" ADD CONSTRAINT "CompletionLog_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
