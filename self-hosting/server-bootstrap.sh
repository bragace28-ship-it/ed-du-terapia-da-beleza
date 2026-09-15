#!/usr/bin/env bash
set -euo pipefail

# Run on a fresh Ubuntu/Debian VPS after DNS is ready.
# This does not contain application secrets.

DOMAIN="${DOMAIN:?Set DOMAIN=seu-dominio.com.br}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi

# Official Supabase self-host installer. It generates production secrets/keys.
curl -fsSL https://supabase.link/setup.sh | sh

cat <<INFO

Base server prepared.

Next:
  1. cd supabase-project
  2. Configure SUPABASE_PUBLIC_URL/API_EXTERNAL_URL/SITE_URL for https://${DOMAIN}/supabase
  3. Configure SMTP and payment secrets.
  4. sh run.sh start
  5. Install the ED & DU frontend using self-hosting/deploy.sh
  6. Configure the reverse proxy and TLS.

Do not expose Postgres publicly unless a firewall rule is explicitly required.
INFO
