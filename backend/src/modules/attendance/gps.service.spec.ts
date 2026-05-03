import { GpsService } from './gps.service';

describe('GpsService', () => {
  const svc = new GpsService();

  it('returns 0 for identical points', () => {
    expect(svc.distance(30.04, 31.23, 30.04, 31.23)).toBeCloseTo(0, 1);
  });

  it('returns ~111km between 1° latitude apart', () => {
    const d = svc.distance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('isWithinRadius returns true when inside', () => {
    expect(svc.isWithinRadius(30.04440, 31.2357, 30.04445, 31.2357, 50)).toBe(true);
  });

  it('isWithinRadius returns false when outside', () => {
    expect(svc.isWithinRadius(30.044, 31.2357, 30.05, 31.24, 50)).toBe(false);
  });
});
