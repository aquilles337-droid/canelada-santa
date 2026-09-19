#!/usr/bin/env bash
# ------------------------------------------------------------------
# Sobe um PostgreSQL temporario, aplica todas as migrations e roda as
# asserções de schema. Serve para validar as migrations antes de aplicá-las
# no Supabase de verdade.
#
#   npm run db:local
#
# Requer postgresql instalado localmente (initdb, pg_ctl, psql).
# ------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-$ROOT/.tmp-pg/data}"
PGSOCK="${PGSOCK:-$ROOT/.tmp-pg/sock}"
PGPORT="${PGPORT:-55432}"
DB="canelada_test"

# O PostgreSQL recusa rodar como root; nesse caso delegamos ao usuario postgres.
RUNAS=""
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  RUNAS="postgres"
fi

run() {
  if [ -n "$RUNAS" ]; then su "$RUNAS" -s /bin/bash -c "$1"; else bash -c "$1"; fi
}

cleanup() {
  run "$PGBIN/pg_ctl -D '$PGDATA' -s -m immediate stop" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ preparando cluster temporario em $PGDATA"
rm -rf "$ROOT/.tmp-pg"
mkdir -p "$PGDATA" "$PGSOCK"
if [ -n "$RUNAS" ]; then chown -R postgres "$ROOT/.tmp-pg"; fi

run "$PGBIN/initdb -D '$PGDATA' -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
run "$PGBIN/pg_ctl -D '$PGDATA' -o \"-k '$PGSOCK' -p $PGPORT -c listen_addresses=''\" -w -l '$ROOT/.tmp-pg/server.log' start" >/dev/null

PSQL="$PGBIN/psql -h '$PGSOCK' -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"

run "$PGBIN/createdb -h '$PGSOCK' -p $PGPORT -U postgres $DB"

echo "→ criando stubs do Supabase (schema auth)"
run "$PSQL -d $DB -f '$ROOT/supabase/test/00_supabase_stub.sql'"

echo "→ aplicando migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   • $(basename "$f")"
  run "$PSQL -d $DB -f '$f'"
done

echo "→ aplicando seed"
run "$PSQL -d $DB -f '$ROOT/supabase/seed.sql'"

echo "→ rodando asserções de schema"
run "$PSQL -d $DB -f '$ROOT/supabase/test/10_schema_assertions.sql'"

echo "→ rodando asserções da lista de espera"
run "$PSQL -d $DB -f '$ROOT/supabase/test/20_presenca_assertions.sql'"

echo "→ rodando asserções do financeiro"
run "$PSQL -d $DB -f '$ROOT/supabase/test/30_pagamentos_assertions.sql'"

echo "→ rodando asserções do guarda de perfil"
run "$PSQL -d $DB -f '$ROOT/supabase/test/40_guarda_de_perfil_assertions.sql'"

echo "→ conferindo a lista de instalação (o mesmo arquivo que o README manda rodar no Supabase)"
run "$PSQL -d $DB -f '$ROOT/supabase/verificar-instalacao.sql'"

echo ""
echo "✓ banco validado: migrations, seed e asserções passaram."
