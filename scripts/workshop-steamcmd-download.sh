#!/usr/bin/env bash
# Download de um item da Workshop (CS2 appid 730) via SteamCMD em Docker, para o
# mesmo sítio que o servidor lê: cs2-data/.../steamapps/workshop/content/730/<id>/
#
# Uso (na raiz do repo, com Docker a correr):
#   ./scripts/workshop-steamcmd-download.sh 3374093005
#
# Imagem: STEAMCMD_DOCKER_IMAGE=steamcmd/steamcmd:latest (podes alterar no ambiente)
set -euo pipefail

ID="${1:-}"
if ! [[ "$ID" =~ ^[0-9]+$ ]]; then
  echo "uso: $0 <workshop_id>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT/cs2-data/game/bin/linuxsteamrt64/steamapps/workshop/content/730"
DEST="$DEST_DIR/$ID"
IMG="${STEAMCMD_DOCKER_IMAGE:-steamcmd/steamcmd:latest}"
TMP=
trap 'if [[ -n "${TMP}" ]]; then rm -rf "${TMP}"; fi' EXIT
TMP=$(mktemp -d)
mkdir -p "$DEST_DIR"

echo "[workshop] A puxar imagem ${IMG} (se ainda não existir) e a descarregar o item $ID em SteamCMD..."
docker run --rm -v "$TMP:/root/.local/share/Steam" "$IMG" \
  +login anonymous +workshop_download_item 730 "$ID" +quit

SRC="$TMP/steamapps/workshop/content/730/$ID"
if [[ ! -d "$SRC" ]]; then
  echo "[workshop] Erro: pasta de download não criada: $SRC" >&2
  find "$TMP" -type f 2>/dev/null | head -20 >&2 || true
  exit 1
fi

mkdir -p "$DEST"
# rsync: sem --delete, por segurança; podes trocar se quiseres mirror exacto
if command -v rsync >/dev/null 2>&1; then
  rsync -a "$SRC/" "$DEST/"
else
  cp -a "$SRC/." "$DEST/"
fi
echo "[workshop] OK: ficheiros em $DEST"
ls -la "$DEST"
