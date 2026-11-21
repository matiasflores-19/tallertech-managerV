#!/usr/bin/env bash
set -euo pipefail

# Render Free no tiene disco persistente: Litestream restaura el SQLite desde
# Supabase Storage al arrancar y replica los cambios mientras el proceso vive.
DATA_DIR="${DATA_DIR:-/tmp/tallertech}"
export DATA_DIR
mkdir -p "$DATA_DIR"

if [ -n "${LITESTREAM_REPLICA_URL:-}" ]; then
  if [ ! -x "./bin/litestream" ]; then
    echo "ERROR: falta bin/litestream. Revisá el Build Command de Render." >&2
    exit 1
  fi
  echo "Iniciando API con Litestream + Supabase Storage..."
  exec ./bin/litestream replicate \
    -config litestream.yml \
    -restore-if-db-not-exists \
    -log-level info \
    -exec "node server/index.js"
fi

echo "Iniciando API sin Litestream (solo para desarrollo local)..."
exec node server/index.js
