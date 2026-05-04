'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { Button, Card, Input, Label } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Renders 6 individual digit boxes for the TOTP input. Auto-advances on type,
 * supports paste of full 6-digit codes, and Backspace navigates back.
 */
function OtpInput({
  value,
  onChange,
  shake,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  shake?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Forward first input ref outside if requested.
  useEffect(() => {
    if (inputRef && refs.current[0]) {
      (inputRef as { current: HTMLInputElement | null }).current = refs.current[0];
    }
  }, [inputRef]);

  return (
    <motion.div
      animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="flex justify-between gap-2"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (t) {
              e.preventDefault();
              onChange(t);
              const idx = Math.min(t.length, 5);
              refs.current[idx]?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6);
            onChange(next);
            if (ch && i < 5) refs.current[i + 1]?.focus();
          }}
          className={cn(
            'h-14 w-12 rounded-md border-2 bg-card text-center text-xl font-semibold tabular-nums',
            'border-border focus:border-seu-red focus:outline-none focus:ring-2 focus:ring-ring',
            'transition-colors',
          )}
        />
      ))}
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@saxony-egypt.edu');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await login(email, password, code || undefined);
      if (r.requires2fa) {
        setNeeds2fa(true);
        return;
      }
      router.push('/dashboard');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Login failed';
      setErr(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="seu-pattern relative grid min-h-screen place-items-center p-4">
      {/* Slow geometric pattern overlay (decorative, navy + gold motes) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{ duration: 60, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(228, 189, 79, 0.06) 0, transparent 30%), radial-gradient(circle at 80% 70%, rgba(177, 34, 42, 0.10) 0, transparent 35%)',
          backgroundSize: '200% 200%',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={shake ? { opacity: 1, y: 0, scale: 1, x: [-6, 6, -4, 4, 0] } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="p-8">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-seu-red text-xl font-bold text-white shadow-card">
              SE
            </div>
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight">Smart Campus Admin</h1>
          <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">Saxony Egypt University</p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {!needs2fa ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-seu-gold/20 text-[#7a5d10]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <Label className="block text-center">Enter the 6-digit code from your authenticator app</Label>
                <OtpInput value={code} onChange={setCode} shake={shake} />
              </div>
            )}

            {err && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-seu-red/30 bg-seu-red/8 px-3 py-2 text-sm text-seu-red"
              >
                {err}
              </motion.p>
            )}

            <Button type="submit" className="w-full" disabled={loading || (needs2fa && code.length !== 6)} size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : needs2fa ? (
                'Verify & continue'
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing in you agree to the SEU acceptable-use policy.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
