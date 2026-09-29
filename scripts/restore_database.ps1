param(
    [Parameter(Mandatory = $true)][string]$Archive,
    [string]$SourceDatabase = $(if ($env:BACKUP_DATABASE) { $env:BACKUP_DATABASE } else { $env:MONGODB_DATABASE })
)

$ErrorActionPreference = "Stop"
if (-not $env:MONGODB_URI) { throw "Set the target MONGODB_URI before running this script." }
if (-not $env:MONGODB_DATABASE) { throw "Set the target MONGODB_DATABASE before running this script." }
if ($env:CONFIRM_RESTORE -ne "YES") { throw "Set CONFIRM_RESTORE=YES to acknowledge that restore uses --drop on the target database." }
if (-not (Get-Command mongorestore -ErrorAction SilentlyContinue)) { throw "mongorestore is not installed or not on PATH." }
$resolvedArchive = (Resolve-Path -LiteralPath $Archive).Path

& mongorestore --uri=$env:MONGODB_URI --nsFrom="$SourceDatabase.*" --nsTo="$($env:MONGODB_DATABASE).*" --archive=$resolvedArchive --gzip --drop
if ($LASTEXITCODE -ne 0) { throw "mongorestore failed with exit code $LASTEXITCODE." }
Write-Host "Restore completed for database $($env:MONGODB_DATABASE)."
