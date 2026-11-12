# MYRYRA - schema-only audit export. READ ONLY; no user data.
# Requires pg_dump and MYRYRA_SCHEMA_DUMP_URL in the local environment.
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:MYRYRA_SCHEMA_DUMP_URL)) {
  throw 'Configure MYRYRA_SCHEMA_DUMP_URL locally; never commit credentials.'
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'pg_dump not found. Install a compatible PostgreSQL client.'
}
$dir = Join-Path ([System.IO.Path]::GetTempPath()) 'myryra-schema-audit'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$out = Join-Path $dir 'myryra-public-schema-only.sql'
$tmp = Join-Path $dir 'myryra-public-schema-only.partial.sql'
try {
  & pg_dump --dbname=$env:MYRYRA_SCHEMA_DUMP_URL --schema-only --schema=public --format=plain --file=$tmp --no-owner
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)." }
  if (-not (Test-Path -LiteralPath $tmp) -or (Get-Item -LiteralPath $tmp).Length -eq 0) {
    throw 'Empty schema export.'
  }
  $dump = Get-Content -LiteralPath $tmp -Raw
  foreach ($required in @('events', 'tasks', 'plans', 'myryra_journeys')) {
    $pattern = '(?m)^CREATE TABLE public\.' + [regex]::Escape($required) + '\s*\('
    if ($dump -notmatch $pattern) {
      throw "Incomplete export: CREATE TABLE public.$required missing."
    }
  }
  if ($dump -notmatch '(?m)^ALTER TABLE public\.myryra_journeys ENABLE ROW LEVEL SECURITY;') {
    throw 'Incomplete export: Journey RLS enable statement missing.'
  }
  Move-Item -LiteralPath $tmp -Destination $out -Force
  Write-Host "Export: $out"
  Write-Host "SHA256: $((Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash)"
} finally {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
}
Write-Host 'WARNING: public-only schema is NOT a complete restorable baseline.'
Write-Host 'Review auth/storage dependencies, extensions, grants, triggers, RLS and migration history.'
Write-Host 'Do not share this file before reviewing potentially sensitive definitions.'
