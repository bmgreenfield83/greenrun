param(
    [string]$OutputDirectory = $(if ($env:BACKUP_DIRECTORY) { $env:BACKUP_DIRECTORY } else { "backups" })
)

$ErrorActionPreference = "Stop"
if (-not $env:MONGODB_URI) { throw "Set MONGODB_URI before running this script." }
if (-not $env:MONGODB_DATABASE) { throw "Set MONGODB_DATABASE before running this script." }
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) { throw "mongodump is not installed or not on PATH." }

$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $resolvedOutput "$($env:MONGODB_DATABASE)-$timestamp.archive.gz"

& mongodump --uri=$env:MONGODB_URI --db=$env:MONGODB_DATABASE --archive=$archive --gzip
if ($LASTEXITCODE -ne 0) { throw "mongodump failed with exit code $LASTEXITCODE." }
Write-Host "Backup created: $archive"
