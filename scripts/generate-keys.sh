#!/usr/bin/env bash
# Generates RS256 keypair + 64-char random secrets and writes them into
# backend/.env. Idempotent — re-running overwrites existing keys.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"

mkdir -p "$ROOT/backend"

# 1) Make sure backend/.env exists, seeded from the root .env.example
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# 2) Generate RS256 keypair (PKCS#8 PEM)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out "$TMPDIR/jwt_private.pem" >/dev/null 2>&1
openssl rsa -pubout -in "$TMPDIR/jwt_private.pem" \
  -out "$TMPDIR/jwt_public.pem" >/dev/null 2>&1

PRIV=$(awk 'BEGIN{ORS="\\n"} {print}' "$TMPDIR/jwt_private.pem")
PUB=$(awk 'BEGIN{ORS="\\n"} {print}' "$TMPDIR/jwt_public.pem")

# 3) Random 64-char hex secrets
REFRESH=$(openssl rand -hex 32)
QRSEC=$(openssl rand -hex 32)

# 4) Patch the .env file in-place
python3 - "$ENV_FILE" "$PRIV" "$PUB" "$REFRESH" "$QRSEC" <<'PY'
import sys, re
path, priv, pub, refresh, qrsec = sys.argv[1:]
src = open(path).read().splitlines()
out = []
seen = {"JWT_ACCESS_PRIVATE_KEY": False, "JWT_ACCESS_PUBLIC_KEY": False,
        "JWT_REFRESH_SECRET": False, "QR_HMAC_SECRET": False}
mapping = {
    "JWT_ACCESS_PRIVATE_KEY": priv,
    "JWT_ACCESS_PUBLIC_KEY": pub,
    "JWT_REFRESH_SECRET": refresh,
    "QR_HMAC_SECRET": qrsec,
}
for line in src:
    m = re.match(r"^([A-Z_][A-Z0-9_]*)=", line)
    if m and m.group(1) in mapping:
        out.append(f'{m.group(1)}="{mapping[m.group(1)]}"')
        seen[m.group(1)] = True
    else:
        out.append(line)
for k, v in mapping.items():
    if not seen[k]:
        out.append(f'{k}="{v}"')
open(path, "w").write("\n".join(out) + "\n")
PY

echo "Wrote keys to $ENV_FILE"
