#!/usr/bin/env sh
set -eu

: "${MONGODB_URI:?Set the target MONGODB_URI before running this script.}"
: "${MONGODB_DATABASE:?Set the target MONGODB_DATABASE before running this script.}"
: "${1:?Usage: restore_database.sh ARCHIVE}"
[ "${CONFIRM_RESTORE:-}" = "YES" ] || { echo "Set CONFIRM_RESTORE=YES to acknowledge that restore uses --drop." >&2; exit 1; }
command -v mongorestore >/dev/null 2>&1 || { echo "mongorestore is not installed or not on PATH." >&2; exit 1; }

archive="$1"
[ -f "$archive" ] || { echo "Archive not found: $archive" >&2; exit 1; }
source_database="${BACKUP_DATABASE:-$MONGODB_DATABASE}"
mongorestore --uri="$MONGODB_URI" --nsFrom="$source_database.*" --nsTo="$MONGODB_DATABASE.*" --archive="$archive" --gzip --drop
printf 'Restore completed for database %s.\n' "$MONGODB_DATABASE"
