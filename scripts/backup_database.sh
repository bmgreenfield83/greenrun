#!/usr/bin/env sh
set -eu

: "${MONGODB_URI:?Set MONGODB_URI before running this script.}"
: "${MONGODB_DATABASE:?Set MONGODB_DATABASE before running this script.}"
command -v mongodump >/dev/null 2>&1 || { echo "mongodump is not installed or not on PATH." >&2; exit 1; }

output_directory="${BACKUP_DIRECTORY:-backups}"
mkdir -p "$output_directory"
archive="$output_directory/$MONGODB_DATABASE-$(date +%Y%m%d-%H%M%S).archive.gz"
mongodump --uri="$MONGODB_URI" --db="$MONGODB_DATABASE" --archive="$archive" --gzip
printf 'Backup created: %s\n' "$archive"
