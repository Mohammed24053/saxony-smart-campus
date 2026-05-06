import { ConfigService } from '@nestjs/config';
import { QrTokenService } from './qr-token.service';

function makeService(intervalSeconds = 30, secret = 'test-secret') {
  const config = {
    getOrThrow: jest
      .fn()
      .mockReturnValue({ hmacSecret: secret, defaultIntervalSeconds: intervalSeconds }),
  } as unknown as ConfigService;
  return new QrTokenService(config);
}

describe('QrTokenService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('builds a payload that round-trips through parsePayload', () => {
    const svc = makeService();
    const { payload, token } = svc.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = svc.parsePayload(payload);
    expect(parsed.sessionId).toBe('s1');
    expect(parsed.roomId).toBe('r1');
    expect(parsed.courseId).toBe('c1');
    expect(parsed.token).toBe(token);
    expect(parsed.intervalSeconds).toBe(30);
  });

  it('verifies a freshly generated token', () => {
    const svc = makeService();
    const { payload } = svc.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = svc.parsePayload(payload);
    const verified = svc.verify(parsed);
    expect(verified).not.toBeNull();
    expect(verified!.sessionId).toBe('s1');
  });

  it('accepts a token from the immediately-previous time window (5s grace)', () => {
    const svc = makeService(30);
    const { payload } = svc.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = svc.parsePayload(payload);
    // Move forward 30 seconds — old token is now in previous window.
    jest.advanceTimersByTime(30_000);
    const verified = svc.verify(parsed);
    expect(verified).not.toBeNull();
  });

  it('rejects a token from too far in the past', () => {
    const svc = makeService(30);
    const { payload } = svc.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = svc.parsePayload(payload);
    jest.advanceTimersByTime(120_000);
    expect(svc.verify(parsed)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const a = makeService(30, 'secret-a');
    const b = makeService(30, 'secret-b');
    const { payload } = a.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = b.parsePayload(payload);
    expect(b.verify(parsed)).toBeNull();
  });

  it('rejects tampered sessionId', () => {
    const svc = makeService();
    const { payload } = svc.buildPayload({ sessionId: 's1', roomId: 'r1', courseId: 'c1' });
    const parsed = svc.parsePayload(payload);
    parsed.sessionId = 'someoneelse';
    expect(svc.verify(parsed)).toBeNull();
  });
});
