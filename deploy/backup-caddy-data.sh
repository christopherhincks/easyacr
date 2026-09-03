#!/usr/bin/env bash
set -euo pipefail

# Run on the deployment host. This archives only Caddy's certificate/account
# state; Supabase data must be backed up through Supabase separately.
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/off-host-sync-directory" >&2
  exit 64
fi

destination="$1"
if [[ "$destination" != /* || "$destination" == "/" ]]; then
  echo "Destination must be a specific absolute directory, not /." >&2
  exit 64
fi

mkdir -p "$destination"
if [[ ! -d "$destination" ]]; then
  echo "Could not create backup destination." >&2
  exit 1
fi

volume="${EASYACR_CADDY_VOLUME:-easyacr_caddy_data}"
if ! docker volume inspect "$volume" >/dev/null 2>&1; then
  echo "Caddy volume $volume was not found. Set EASYACR_CADDY_VOLUME if your Compose project uses another name." >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$destination/easyacr-caddy-data-$stamp.tar.gz"
docker run --rm \
  -v "$volume:/source:ro" \
  -v "$destination:/backup" \
  alpine:3.20 \
  tar -C /source -czf "/backup/$(basename "$archive")" .

test -s "$archive"
sha256sum "$archive" > "$archive.sha256"
echo "Created $archive and $archive.sha256. Copy both to encrypted off-host storage and test restoration before relying on this backup."
