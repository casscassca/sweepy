#!/bin/sh
set -eu

REMOTE="${RCLONE_REMOTE:-gdrive:backups/sweepy}"
URL="${DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "$URL" ]; then
  echo "backup: DIRECT_URL or DATABASE_URL is missing" >&2
  exit 1
fi

if ! rclone lsd gdrive: >/dev/null; then
  echo "backup: rclone cannot list gdrive:" >&2
  exit 1
fi

stamp=$(date +%Y%m%d)
file="/tmp/sweepy-${stamp}.sql.gz"
rm -f "$file"
rclone mkdir "$REMOTE" >/dev/null 2>&1 || true
pg_dump --no-owner --no-acl "$URL" | gzip > "$file"
rclone copy "$file" "$REMOTE"
rclone delete "$REMOTE" --min-age 30d --include "sweepy-*.sql.gz" || true
rm -f "$file"
ok=0
i=0
while [ "$i" -lt 12 ]; do
  if psql "$URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "Settings" (id, "backupAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET "backupAt" = CURRENT_TIMESTAMP;
SQL
  then
    ok=1
    break
  fi
  i=$((i + 1))
  sleep 5
done
if [ "$ok" -ne 1 ]; then
  echo "backup: uploaded the dump but could not record backupAt" >&2
  exit 1
fi
echo "backup: uploaded sweepy-${stamp}.sql.gz to ${REMOTE}"
