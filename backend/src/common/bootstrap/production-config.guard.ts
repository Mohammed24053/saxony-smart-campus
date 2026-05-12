import { Logger } from '@nestjs/common';

/**
 * Hard guard that prevents the API from booting into a production
 * environment with insecure defaults still in place. This is intentionally
 * loud and unforgiving: a misconfigured production deploy should fail-fast
 * at boot time, not silently run with a known-bad secret.
 *
 * Checks (only run when NODE_ENV === 'production'):
 *  - JWT signing keys are set and non-trivial.
 *  - JWT refresh secret is at least 32 chars and not the .env.example
 *    placeholder.
 *  - QR HMAC secret is at least 32 chars and not the placeholder.
 *  - INITIAL_ADMIN_PASSWORD is not the historically-shipped default and is
 *    at least 12 chars (the admin is created on first boot if missing).
 *  - ADMIN_WEB_ORIGIN is an explicit allow-list, not `*`.
 *  - MINIO_SECRET_KEY isn't the docker-compose dev value.
 *  - SMTP password isn't blank if SMTP_HOST is set.
 *
 * Each failing check is logged with the exact env var to fix, and the
 * process exits with a non-zero status so a process supervisor (systemd,
 * Docker, k8s) treats it as a failed start.
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const log = new Logger('ProductionConfigGuard');
  const errors: string[] = [];

  const requireNonEmpty = (name: string, value: string | undefined) => {
    if (!value || value.trim() === '') errors.push(`${name} must be set in production`);
  };
  const requireMinLength = (name: string, value: string | undefined, n: number) => {
    if (!value || value.length < n) {
      errors.push(`${name} must be at least ${n} characters in production`);
    }
  };
  const refuseValue = (name: string, value: string | undefined, banned: readonly string[]) => {
    if (value && banned.includes(value)) {
      errors.push(`${name} is still set to a known-default value (${value}); change it`);
    }
  };

  requireNonEmpty('JWT_ACCESS_PRIVATE_KEY', env.JWT_ACCESS_PRIVATE_KEY);
  requireNonEmpty('JWT_ACCESS_PUBLIC_KEY', env.JWT_ACCESS_PUBLIC_KEY);
  requireMinLength('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, 32);
  refuseValue('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, [
    'please-change-me-to-a-64-char-random-string',
  ]);

  requireMinLength('QR_HMAC_SECRET', env.QR_HMAC_SECRET, 32);
  refuseValue('QR_HMAC_SECRET', env.QR_HMAC_SECRET, [
    'please-change-me-to-a-64-char-random-string',
  ]);

  requireMinLength('INITIAL_ADMIN_PASSWORD', env.INITIAL_ADMIN_PASSWORD, 12);
  refuseValue('INITIAL_ADMIN_PASSWORD', env.INITIAL_ADMIN_PASSWORD, ['ChangeMe!2025']);

  if (env.ADMIN_WEB_ORIGIN === '*' || env.ADMIN_WEB_ORIGIN === undefined) {
    errors.push('ADMIN_WEB_ORIGIN must be an explicit comma-separated allow-list (not "*")');
  }

  refuseValue('MINIO_ACCESS_KEY', env.MINIO_ACCESS_KEY, ['campusminio']);
  refuseValue('MINIO_SECRET_KEY', env.MINIO_SECRET_KEY, ['campusminio']);

  refuseValue('COOKIE_SECRET', env.COOKIE_SECRET, ['please-change-me']);

  if (env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASSWORD)) {
    errors.push('SMTP_HOST is set but SMTP_USER / SMTP_PASSWORD are missing');
  }

  if (errors.length > 0) {
    log.error('Refusing to boot into production with insecure configuration:');
    for (const e of errors) log.error(`  · ${e}`);
    log.error('See SECURITY_HARDENING_CHECKLIST.md → "Production env check" for how to fix.');
    // Fail-fast so process supervisors restart and surface the problem.
    process.exit(1);
  }
}
