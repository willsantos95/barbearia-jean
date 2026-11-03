#!/usr/bin/env bash
# Junta todas as migrations + seed em supabase/setup.sql (instalação do zero)
set -e
cd "$(dirname "$0")/../supabase"
{
  echo "-- ARQUIVO GERADO por scripts/gerar-setup.sh: rode inteiro no SQL Editor (instalação do zero)"
  for f in migrations/*.sql seed.sql; do echo; echo "-- >>> $f"; cat "$f"; done
} > setup.sql
echo "setup.sql gerado"
