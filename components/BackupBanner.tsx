"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { backupIsStale } from "@/lib/backup";
import { readJson } from "@/lib/read-json";

export default function BackupBanner() {
  const path = usePathname();
  const [backupAt, setBackupAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (path === "/login") return;
    fetch("/api/settings")
      .then((res) => readJson<{ backupAt?: string | null }>(res, {}))
      .then((s) => setBackupAt(s.backupAt ?? null))
      .catch(() => setBackupAt(null));
  }, [path]);

  if (path === "/login" || backupAt === undefined || !backupIsStale(backupAt)) return null;

  const label = backupAt
    ? "Drive backup is more than 2 days old"
    : "Drive backup has not run yet";

  return (
    <div
      role="status"
      className="px-4 py-2.5 text-sm text-center"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", color: "var(--red)" }}
    >
      <Link href="/settings" prefetch={false} className="font-medium">
        {label}
      </Link>
    </div>
  );
}
