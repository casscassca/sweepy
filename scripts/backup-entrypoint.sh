#!/bin/sh
set -eu

seconds_until_4am() {
  h=$(date +%H)
  m=$(date +%M)
  s=$(date +%S)
  h=${h#0}; m=${m#0}; s=${s#0}
  h=${h:-0}; m=${m:-0}; s=${s:-0}
  now=$((h * 3600 + m * 60 + s))
  target=$((4 * 3600))
  if [ "$now" -ge "$target" ]; then
    echo $((86400 - now + target))
  else
    echo $((target - now))
  fi
}

echo "backup: rclone remotes"
rclone lsd gdrive: || echo "backup: gdrive: not reachable yet" >&2

/scripts/backup.sh || echo "backup: run failed" >&2

while true; do
  sleep "$(seconds_until_4am)"
  /scripts/backup.sh || echo "backup: run failed" >&2
done
