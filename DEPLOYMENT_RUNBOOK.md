# Deployment Runbook

Saxony Smart Campus — production deployment, infrastructure hardening,
and operational procedures.

This runbook is the operator's reference. It pairs with
[`SECURITY_HARDENING_CHECKLIST.md`](./SECURITY_HARDENING_CHECKLIST.md),
which tracks **what** needs to be true at launch; this document covers
**how** to make it true and **how** to verify.

> All commands assume Ubuntu 22.04 LTS on the application server. Adapt
> the package manager / firewall syntax for RHEL / Amazon Linux as
> needed. AWS-specific equivalents are noted inline.

---

## 0 — Prerequisites

| Tool           | Min version | Why                                          |
| -------------- | ----------- | -------------------------------------------- |
| Docker         | 24.x        | Backend + admin run as containers            |
| Docker Compose | v2 (plugin) | Compose file uses v3.9 schema                |
| Node.js        | 20 LTS      | Building the admin SPA outside the container |
| pnpm           | 9.x         | Workspace package manager                    |
| `certbot`      | 2.x         | Let's Encrypt cert issuance                  |
| `ufw`          | any         | Host firewall                                |
| `nmap`         | any         | Verify TLS / port posture                    |

---

## 1 — One-time server hardening

### 1.1 Create a non-root deploy user

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker,sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.2 SSH hardening

Edit `/etc/ssh/sshd_config`:

```ini
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
AllowUsers deploy
```

Then:

```bash
sudo systemctl restart ssh
# from a *new* terminal, verify before disconnecting:
ssh -p 2222 deploy@<server-ip> 'echo ok'
```

> **AWS equivalent:** Set the security group rule for port 22 to your
> office IP only. Use Session Manager or EC2 Instance Connect to avoid
> opening SSH publicly at all.

### 1.3 UFW firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp comment "SSH (custom port)"
sudo ufw allow 80/tcp   comment "HTTP (redirects to HTTPS)"
sudo ufw allow 443/tcp  comment "HTTPS"
sudo ufw --force enable
sudo ufw status verbose
```

Expected output:

```
22/tcp                     DENY        Anywhere
2222/tcp                   ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> **AWS equivalent:** Security group with rules for `:80`, `:443` from
> `0.0.0.0/0`, `:2222` from `<office-ip>/32`. Database SG only accepts
> `:5432` from the application SG.

### 1.4 Unattended security upgrades

```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 1.5 Fail2ban for SSH

```bash
sudo apt-get install -y fail2ban
sudo tee /etc/fail2ban/jail.d/sshd.local >/dev/null <<EOF
[sshd]
enabled = true
port    = 2222
maxretry = 5
findtime = 600
bantime = 3600
EOF
sudo systemctl restart fail2ban
```

---

## 2 — TLS / HTTPS

### 2.1 Issue the certificate (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d api.example.edu \
  -d admin.example.edu \
  --redirect \
  --hsts \
  --staple-ocsp \
  --email security@example.edu \
  --agree-tos --no-eff-email
```

`--redirect` adds the HTTP→HTTPS redirect. `--hsts` enables HSTS at the
proxy layer. The cert auto-renews via the `certbot.timer` systemd unit
(verify with `systemctl list-timers | grep certbot`).

### 2.2 nginx TLS hardening

`/etc/nginx/snippets/tls.conf`:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 1.0.0.1 valid=300s;

# HSTS (1y, includeSubDomains, preload)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

`include snippets/tls.conf;` in each `server { listen 443 ssl; ... }` block.

### 2.3 Verify TLS posture

```bash
nmap --script ssl-enum-ciphers -p 443 api.example.edu
# Should report TLSv1.2 + TLSv1.3 only.

curl -I https://api.example.edu/api/v1/health
# Should include: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

curl -I http://api.example.edu/
# Should return 301 / 308 to https://
```

Optional public report: <https://www.ssllabs.com/ssltest/analyze.html?d=api.example.edu>

---

## 3 — Database

### 3.1 Provision the production Postgres role

```sql
-- as the postgres superuser:
CREATE DATABASE smart_campus;
CREATE USER campus_app WITH PASSWORD '<strong-random-password>';

REVOKE ALL ON DATABASE smart_campus FROM PUBLIC;
GRANT CONNECT ON DATABASE smart_campus TO campus_app;

\c smart_campus
GRANT USAGE ON SCHEMA public TO campus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campus_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO campus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO campus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO campus_app;
-- NO CREATEDB, NO CREATEROLE, NO SUPERUSER.
```

Migrations run as a one-off task with a _separate_ role that owns the
schema (e.g. `campus_migrate`). The runtime app role can only DML.

### 3.2 Lock down Postgres

`/etc/postgresql/16/main/postgresql.conf`:

```ini
listen_addresses = '127.0.0.1'   # or the private VPC IP
ssl = on
ssl_cert_file = '/etc/ssl/certs/postgres.crt'
ssl_key_file  = '/etc/ssl/private/postgres.key'
password_encryption = scram-sha-256
log_connections = on
log_disconnections = on
log_line_prefix = '%m [%p] %q%u@%d/%a '
log_min_duration_statement = 250ms
```

`/etc/postgresql/16/main/pg_hba.conf`:

```
# TYPE  DATABASE   USER         ADDRESS         METHOD
hostssl smart_campus campus_app  10.0.0.0/8      scram-sha-256
local   all          all                          peer
```

### 3.3 Encryption at rest

- **AWS RDS:** Enable storage encryption at instance creation (KMS-backed). Cannot be enabled on an existing unencrypted instance — snapshot → restore-as-encrypted.
- **Self-managed:** `cryptsetup luksFormat` the data volume; mount via `/etc/crypttab` with a key from a hardware module / Vault.
- **Field-level for credentials:** already handled in code — `passwordHash`, `tokenHash`, `totpSecret`, FCM `token` are all hashed or encrypted at the application layer.

### 3.4 Automated backups

```bash
sudo tee /usr/local/bin/pg-backup.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
PGPASSWORD=<read-only-backup-password> \
  pg_dump -Fc -h 127.0.0.1 -U campus_backup smart_campus \
  | gzip -9 \
  > /var/backups/postgres/smart_campus-${TS}.dump.gz
aws s3 cp /var/backups/postgres/smart_campus-${TS}.dump.gz \
  s3://example-edu-backups/smart-campus/ \
  --storage-class STANDARD_IA \
  --sse aws:kms
find /var/backups/postgres -mtime +7 -delete
EOF
sudo chmod 700 /usr/local/bin/pg-backup.sh

sudo tee /etc/cron.d/pg-backup >/dev/null <<'EOF'
0 2 * * * root /usr/local/bin/pg-backup.sh
EOF
```

Test restore quarterly:

```bash
aws s3 cp s3://example-edu-backups/smart-campus/<latest>.dump.gz - \
  | gunzip \
  | pg_restore -h <restore-host> -U postgres -d smart_campus_restore_test --clean
```

---

## 4 — Application deployment

### 4.1 Production env file

`/opt/smart-campus/.env.production` (mode 0600, owned by `deploy`):

```bash
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# CORS — explicit allow-list, NEVER "*"
ADMIN_WEB_ORIGIN=https://admin.example.edu

# JWT — generate with scripts/generate-keys.sh
JWT_ACCESS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_ACCESS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_REFRESH_SECRET=<64-char-random-string>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# QR HMAC
QR_HMAC_SECRET=<64-char-random-string>
QR_DEFAULT_INTERVAL_SECONDS=30

# Cookie signing (signed cookies for refresh-token rotation)
COOKIE_SECRET=<32-char-random-string>

# DB
DATABASE_URL=postgresql://campus_app:<password>@10.0.1.20:5432/smart_campus?schema=public&sslmode=require

# Redis
REDIS_URL=redis://10.0.1.21:6379

# MinIO / S3
MINIO_ENDPOINT=s3.example.edu
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<rotated-key>
MINIO_SECRET_KEY=<rotated-secret>
MINIO_BUCKET=smart-campus-prod

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."

# Initial admin (random — rotate after first login)
INITIAL_ADMIN_EMAIL=ops+admin@example.edu
INITIAL_ADMIN_PASSWORD=<one-time-random-password>

# SMTP
SMTP_HOST=smtp.example.edu
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@example.edu
SMTP_PASSWORD=<rotated>
SMTP_FROM=no-reply@example.edu

# Observability
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info

# Swagger explicitly *not* exposed in production
# EXPOSE_SWAGGER=true   # uncomment only on staging
```

`assertProductionConfig()` will refuse to boot if any of the above is
left at its `.env.example` default.

### 4.2 Generate secrets

```bash
# JWT RS256 keypair
./scripts/generate-keys.sh

# Random secrets
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "QR_HMAC_SECRET=$(openssl rand -hex 32)"
echo "COOKIE_SECRET=$(openssl rand -hex 16)"
echo "INITIAL_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
```

### 4.3 Build + push images (CI)

GitHub Actions workflow (`.github/workflows/release.yml`):

```yaml
- run: docker buildx build --platform linux/amd64,linux/arm64 \
    --build-arg GIT_SHA=${{ github.sha }} \
    -t registry.example.edu/smart-campus-backend:${{ github.sha }} \
    -t registry.example.edu/smart-campus-backend:latest \
    -f backend/Dockerfile --push .
```

### 4.4 Database migration (one-off, before app start)

```bash
ssh deploy@prod 'cd /opt/smart-campus && \
  docker run --rm \
    --env-file .env.production.migrate \
    registry.example.edu/smart-campus-backend:<sha> \
    pnpm --filter backend prisma migrate deploy'
```

`.env.production.migrate` uses the `campus_migrate` role, not `campus_app`.

### 4.5 Deploy backend + admin

```bash
ssh deploy@prod
cd /opt/smart-campus
export IMAGE_TAG=<short-sha>
docker compose pull
docker compose up -d --no-deps backend admin
docker compose ps
```

Smoke-test the live deploy:

```bash
curl -sf https://api.example.edu/api/v1/health
curl -sf https://admin.example.edu/api/health
```

### 4.6 Rollback

```bash
ssh deploy@prod
cd /opt/smart-campus
export IMAGE_TAG=<previous-known-good-sha>
docker compose pull
docker compose up -d --no-deps backend admin
```

Database rollback: do **not** roll back schema; forward-only migrations
are the contract. If the new migration is broken, ship a follow-up
migration that reverses it.

---

## 5 — Staged deploy workflow

```
┌──────────┐   pnpm test    ┌──────────┐   smoke + ZAP   ┌──────────┐
│  branch  │ ─────────────▶ │ staging  │ ──────────────▶ │   prod   │
└──────────┘                └──────────┘                 └──────────┘
       ▲                          │                            │
       │                          ▼                            ▼
   feature work             smoke@staging                 monitor 24h
```

### 5.1 Smoke tests (every staging deploy)

```bash
# Admin Playwright smoke (auto-runs in CI)
pnpm --filter admin smoke -- --base-url=https://admin-staging.example.edu

# Mobile Flutter widget tests
cd mobile && flutter test

# Critical user flows manual check:
#  1. Admin login at https://admin-staging.example.edu
#  2. Create a room with Wi-Fi BSSID + BLE beacon ID
#  3. Open a session; verify QR code rotates every 30s
#  4. Mobile: login as student, scan, verify attendance recorded
#  5. Admin: open report, export CSV, verify no formula injection
```

### 5.2 Pen-test gate (every staging deploy)

```bash
docker run --rm -v $(pwd)/zap-report:/zap/wrk \
  -t zaproxy/zap-stable zap-baseline.py \
  -t https://api-staging.example.edu \
  -r baseline.html
```

Review `zap-report/baseline.html`. Block promotion if any `High` finding
isn't in the accepted-risks list.

---

## 6 — Monitoring & alerting

### 6.1 Uptime monitor

UptimeRobot HTTPS keyword monitor on:

- `GET https://api.example.edu/api/v1/health` — expect `{"status":"ok"}`
- `GET https://admin.example.edu/` — expect HTTP 200
- 60s interval, alert after 2 failures (≈ 2 min downtime).

### 6.2 Failed-login alert

Sentry / Datadog query:

```
status:401 path:/api/v1/auth/login source:nestjs
```

Alert when rate > 5/min from the same source IP. Auto-block via WAF rule
if rate > 30/min sustained.

### 6.3 API traffic spike alert

Datadog APM:

```
avg:trace.express.request.hits{service:smart-campus-api} > 3 * baseline(30m)
```

### 6.4 Error-rate alert

```
avg:trace.express.request.errors{service:smart-campus-api} > 0.02
```

(>2% error rate sustained 5 min → page on-call.)

---

## 7 — Incident response

See **Incident Response Plan** in
[`SECURITY_HARDENING_CHECKLIST.md`](./SECURITY_HARDENING_CHECKLIST.md).

### Common runbooks

#### 7.1 Suspected credential leak (one user)

```sql
-- Revoke all refresh-token families for the user
UPDATE "RefreshToken"
SET "revokedAt" = NOW()
WHERE "userId" = '<user-uuid>';

-- Force password reset email
INSERT INTO "PasswordResetRequest"(...) VALUES (...);
```

#### 7.2 Suspected DB compromise

1. Snapshot the DB volume immediately.
2. Rotate every secret in `.env.production` (JWT, QR, MinIO, SMTP, Sentry).
3. Force-revoke all refresh tokens: `UPDATE "RefreshToken" SET "revokedAt" = NOW();`
4. Force every user to re-login: bump `JWT_KEY_VERSION` env var (the access-token guard rejects tokens whose `kid` ≠ the current version).
5. Email all university IT admins with the timeline and remediation.

#### 7.3 Suspected WebSocket abuse

1. Restart the API instance — Socket.IO sessions drop and re-authenticate.
2. If sustained, add a WAF rule to rate-limit `/socket.io/` per IP.
3. Investigate via `X-Request-Id` correlated logs.

#### 7.4 Stuck Bull queue

```bash
ssh deploy@prod 'docker compose exec backend node -e "
  const Queue = require(\"bull\");
  const q = new Queue(\"at-risk\", process.env.REDIS_URL);
  q.getJobCounts().then(console.log).then(() => q.close());
"'
```

Or visit `/api/v1/admin/queues` (Bull-Board, admin JWT required).

---

## 8 — Quarterly review

- [ ] Run `pnpm audit` and refresh the accepted-risks list.
- [ ] Run a full OWASP ZAP authenticated scan against staging.
- [ ] Rotate all production secrets (JWT, QR, COOKIE, MinIO, SMTP).
- [ ] Test restore-from-backup on a clean Postgres instance.
- [ ] Review SSH `authorized_keys` on every prod server.
- [ ] Tabletop a SEV-1 incident with the on-call rotation.
