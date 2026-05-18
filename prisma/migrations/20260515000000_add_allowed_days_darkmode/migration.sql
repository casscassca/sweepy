-- AlterTable
ALTER TABLE "Task" ADD COLUMN "allowedDays" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "darkMode" BOOLEAN NOT NULL DEFAULT 0;
