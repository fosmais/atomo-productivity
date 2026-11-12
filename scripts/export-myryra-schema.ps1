# MYRYRA: exportacao somente de schema; nao exporta dados pessoais.
# Requer pg_dump e MYRYRA_SCHEMA_DUMP_URL definida localmente.
$ErrorActionPreference = 'Stop'
if (-not $env:MYRYRA_SCHEMA_DUMP_URL) { throw 'Defina MYRYRA_SCHEMA_DUMP_URL localmente; nunca salve credenciais no Git.' }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw 'pg_dump nao encontrado.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dir = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$out = Join-Path $dir 'myryra-public-schema-only.sql'
& pg_dump --dbname=$env:MYRYRA_SCHEMA_DUMP_URL --schema-only --schema=public --format=plain --file=$out --no-owner
if ($LASTEXITCODE -ne 0) { Remove-Item $out -ErrorAction SilentlyContinue; throw 'Falha no pg_dump.' }
Write-Host 'Schema exportado para artifacts/myryra-public-schema-only.sql'
Write-Host 'Snapshot incompleto para restauracao: revisar auth, storage, extensoes, grants, triggers e historico de migrations.'
Write-Host 'Revisar antes de versionar; nunca commitar credenciais.'
