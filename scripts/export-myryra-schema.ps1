# MYRYRA - exportacao schema-only para auditoria; NAO altera o banco.
# Requer pg_dump e MYRYRA_SCHEMA_DUMP_URL configurados no ambiente local.
# Uso: powershell -NoProfile -File scripts/export-myryra-schema.ps1
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:MYRYRA_SCHEMA_DUMP_URL)) {
  throw 'Defina MYRYRA_SCHEMA_DUMP_URL no ambiente local; nunca registre credenciais no Git.'
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'pg_dump nao encontrado. Instale um cliente PostgreSQL compativel com o servidor.'
}
# Fora do repositorio para reduzir risco de commit acidental do snapshot.
$dir = Join-Path ([System.IO.Path]::GetTempPath()) 'myryra-schema-audit'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$out = Join-Path $dir 'myryra-public-schema-only.sql'
$tmp = Join-Path $dir 'myryra-public-schema-only.partial.sql'
try {
  & pg_dump --dbname=$env:MYRYRA_SCHEMA_DUMP_URL --schema-only --schema=public --format=plain --file=$tmp --no-owner
  if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (exit code $LASTEXITCODE)." }
  if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -eq 0) { throw 'Exportacao vazia.' }
  Move-Item -LiteralPath $tmp -Destination $out -Force
} finally {
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force }
}
Write-Host "Exportacao concluida: $out"
Write-Host 'ATENCAO: dump de public nao e baseline restauravel completo.'
Write-Host 'Revisar dependencias de auth/storage, extensoes, funcoes, triggers, grants, RLS e migracoes.'
Write-Host 'Nao compartilhar o dump sem revisar definicoes potencialmente sensiveis.'
