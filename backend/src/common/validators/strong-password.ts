import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Minimum password requirements.
 *
 * Aligned with NIST SP 800-63B section 5.1.1.2:
 *   - ≥ 12 characters (longer is materially more useful than complexity rules)
 *   - At least one lower, upper, digit, and non-alphanumeric character — these
 *     guardrails reduce the impact of credential-stuffing dictionaries even
 *     though length is the dominant strength factor.
 *   - Reject the most common ~50 throwaway passwords
 */
const MIN_LENGTH = 12;

const BANNED = new Set<string>([
  'password',
  'password1',
  'password123',
  'password1234',
  'qwerty',
  'qwerty123',
  'letmein',
  'welcome',
  'welcome1',
  'admin',
  'admin123',
  'administrator',
  'changeme',
  'changeme!',
  'changeme123',
  '12345678',
  '123456789',
  '1234567890',
  'iloveyou',
  'sunshine',
  'princess',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'starwars',
]);

export interface StrongPasswordResult {
  ok: boolean;
  reason?: string;
}

export function isStrongPassword(value: unknown): StrongPasswordResult {
  if (typeof value !== 'string') return { ok: false, reason: 'password must be a string' };
  if (value.length < MIN_LENGTH)
    return { ok: false, reason: `password must be at least ${MIN_LENGTH} characters` };
  if (value.length > 128) return { ok: false, reason: 'password too long' };
  if (BANNED.has(value.toLowerCase()))
    return { ok: false, reason: 'password is too common — choose a less predictable one' };
  if (!/[a-z]/.test(value))
    return { ok: false, reason: 'password must contain a lowercase letter' };
  if (!/[A-Z]/.test(value))
    return { ok: false, reason: 'password must contain an uppercase letter' };
  if (!/[0-9]/.test(value)) return { ok: false, reason: 'password must contain a digit' };
  if (!/[^A-Za-z0-9]/.test(value))
    return { ok: false, reason: 'password must contain a non-alphanumeric character' };
  return { ok: true };
}

export function IsStrongPassword(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'IsStrongPassword',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate(value: unknown) {
          return isStrongPassword(value).ok;
        },
        defaultMessage(args: ValidationArguments) {
          return isStrongPassword(args.value).reason ?? 'password is not strong enough';
        },
      },
    });
  };
}
