#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-https://cwdpwfzsasdsetthmpoa.supabase.co}}"
PAGES_URL="${PAGES_URL:-https://ed-du-terapia-da-beleza.pages.dev}"
EXPECTED_VERSION="${EXPECTED_VERSION:-33.0.0}"

fail(){ echo "[readiness] FAIL: $*" >&2; exit 1; }
pass(){ echo "[readiness] PASS: $*"; }

command -v curl >/dev/null 2>&1 || fail "curl não encontrado"

health="$(curl -fsS -o /dev/null -w '%{http_code}' "$SUPABASE_URL/auth/v1/health")" || fail "Supabase Auth health não respondeu"
[[ "$health" == "200" ]] || fail "Supabase Auth health retornou HTTP $health"
pass "Supabase API/Auth health HTTP 200"

version_json="$(curl -fsS "$PAGES_URL/version.json")" || fail "não foi possível obter $PAGES_URL/version.json"
node -e 'const x=JSON.parse(process.argv[1]); if(x.version!==process.argv[2]) process.exit(1)' "$version_json" "$EXPECTED_VERSION" || fail "version.json não está em $EXPECTED_VERSION: $version_json"
pass "Cloudflare Pages version.json = $EXPECTED_VERSION"

[[ -f dist/_redirects ]] || fail "dist/_redirects não existe; rode npm run build antes da verificação"
grep -Fxq '/* /index.html 200' dist/_redirects || fail "dist/_redirects não contém SPA fallback"
pass "dist/_redirects presente com SPA fallback"

echo "[readiness] PRODUCTION_READINESS=PASS"
