# Database backup and portability

Backups use the official MongoDB Database Tools (`mongodump` and `mongorestore`). Install tools compatible with the source and target MongoDB versions and ensure both commands are on `PATH`. Scripts read environment variables only and never embed or print connection strings.

## Back up Atlas or local MongoDB

Set `MONGODB_URI` and `MONGODB_DATABASE` in the current terminal. Optionally set `BACKUP_DIRECTORY`; it defaults to the ignored repository `backups/` directory.

```powershell
./scripts/backup_database.ps1
```

```sh
sh ./scripts/backup_database.sh
```

The result is a timestamped gzip-compressed archive. Copy it to durable storage; repository-local backups are not source control.

## Restore

Restore is deliberately guarded because it uses `--drop` and replaces collections in the target database. Set the target `MONGODB_URI`, target `MONGODB_DATABASE`, and `CONFIRM_RESTORE=YES`. When restoring to a differently named database, also set `BACKUP_DATABASE` to the database name contained in the archive.

```powershell
$env:CONFIRM_RESTORE="YES"
./scripts/restore_database.ps1 -Archive ./backups/running_tracker-20260805-120000.archive.gz
```

```sh
CONFIRM_RESTORE=YES sh ./scripts/restore_database.sh ./backups/running_tracker-20260805-120000.archive.gz
```

The same procedure supports Atlas-to-local, local-to-Atlas, and Atlas-to-Atlas transfers by changing target environment variables. After restoring, run `npm.cmd run init:database` to ensure current indexes and the settings singleton exist, then `npm.cmd run check:database`.

Never pass a connection string on a shared command line, store an archive in Git, or restore over a database you have not independently backed up.
