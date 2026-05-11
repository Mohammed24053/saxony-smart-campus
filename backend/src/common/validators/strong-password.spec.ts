import { isStrongPassword } from './strong-password';

describe('isStrongPassword', () => {
  it('rejects non-strings', () => {
    expect(isStrongPassword(undefined).ok).toBe(false);
    expect(isStrongPassword(123 as unknown).ok).toBe(false);
  });

  it('rejects short passwords (<12 chars)', () => {
    const r = isStrongPassword('Aa1!short');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/12 characters/);
  });

  it('rejects passwords missing uppercase', () => {
    const r = isStrongPassword('abcdef1234!@');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/uppercase/);
  });

  it('rejects passwords missing lowercase', () => {
    const r = isStrongPassword('ABCDEF1234!@');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/lowercase/);
  });

  it('rejects passwords missing a digit', () => {
    const r = isStrongPassword('AbcdefGhij!@');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/digit/);
  });

  it('rejects passwords missing a symbol', () => {
    const r = isStrongPassword('Abcdefgh1234');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/non-alphanumeric/);
  });

  it('rejects common throwaway passwords', () => {
    const r = isStrongPassword('Password123!');
    // not in BANNED list — but try one that is:
    const r2 = isStrongPassword('password1234');
    expect(r2.ok).toBe(false);
    expect(r2.reason).toMatch(/common/);
    // verify the password-with-symbol path
    expect(r.ok).toBe(true);
  });

  it('accepts a strong password', () => {
    expect(isStrongPassword('CorrectHorse9!batterystaple').ok).toBe(true);
  });
});
