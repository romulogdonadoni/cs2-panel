#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose build panel
docker compose up -d panel
echo "Panel rebuild e up concluídos (cs2-panel)."
