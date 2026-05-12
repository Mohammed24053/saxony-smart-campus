import { assertProductionConfig } from './production-config.guard';

describe('assertProductionConfig', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code ?? 0}`);
  }) as never);

  afterEach(() => {
    exitSpy.mockClear();
  });

  // Helper: a minimal env that satisfies every check, so individual tests
  // can mutate a single field and assert that one specific failure trips.
  const goodEnv = (): NodeJS.ProcessEnv => ({
    NODE_ENV: 'production',
    JWT_ACCESS_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    JWT_ACCESS_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
    JWT_REFRESH_SECRET: 'a'.repeat(64),
    QR_HMAC_SECRET: 'b'.repeat(64),
    INITIAL_ADMIN_PASSWORD: 'Sup3rStr0ng!Pa55',
    ADMIN_WEB_ORIGIN: 'https://admin.example.com',
    MINIO_ACCESS_KEY: 'rotated-key',
    MINIO_SECRET_KEY: 'rotated-secret-rotated-secret',
  });

  it('is a no-op outside production', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development' })).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('accepts a fully-configured production env', () => {
    expect(() => assertProductionConfig(goodEnv())).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('refuses to boot when INITIAL_ADMIN_PASSWORD is still the historical default', () => {
    const env = { ...goodEnv(), INITIAL_ADMIN_PASSWORD: 'ChangeMe!2025' };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('refuses to boot when QR_HMAC_SECRET is the .env.example placeholder', () => {
    const env = {
      ...goodEnv(),
      QR_HMAC_SECRET: 'please-change-me-to-a-64-char-random-string',
    };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
  });

  it('refuses to boot when ADMIN_WEB_ORIGIN is "*"', () => {
    const env = { ...goodEnv(), ADMIN_WEB_ORIGIN: '*' };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
  });

  it('refuses to boot when JWT signing keys are empty', () => {
    const env = { ...goodEnv(), JWT_ACCESS_PRIVATE_KEY: '' };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
  });

  it('refuses to boot when MinIO is still on docker-compose defaults', () => {
    const env = { ...goodEnv(), MINIO_SECRET_KEY: 'campusminio' };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
  });

  it('refuses to boot when SMTP_HOST is set but credentials are missing', () => {
    const env = { ...goodEnv(), SMTP_HOST: 'smtp.gmail.com' };
    expect(() => assertProductionConfig(env)).toThrow(/process.exit:1/);
  });
});
