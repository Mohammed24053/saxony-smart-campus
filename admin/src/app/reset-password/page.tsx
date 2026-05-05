'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label } from '@/components/ui';
import { useT } from '@/i18n/i18n';

function ResetPasswordInner() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    if (password.length < 8) { setErr(t('errors.tooShort', { min: 8 })); return; }
    setLoading(true);
    try {
      await api.post('/auth/password/reset', { token, newPassword: password });
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? t('auth.invalidToken');
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-seu-red">{t('auth.invalidToken')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="text-center text-[20px] font-semibold tracking-tight">{t('auth.resetPassword')}</h1>
      {done ? (
        <div className="mt-5 rounded-md border border-status-success/30 bg-status-success/10 px-3 py-3 text-center text-sm text-status-success">
          <CheckCircle2 className="mb-1 inline h-4 w-4" /> {t('auth.resetSuccess')}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pwd">{t('auth.newPassword')}</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          {err && (
            <p className="rounded-md border border-seu-red/30 bg-seu-red/8 px-3 py-2 text-sm text-seu-red">{err}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('common.saving')}</> : t('auth.resetPassword')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-xs">
        <Link href="/login" className="text-muted-foreground hover:text-seu-red hover:underline">
          ← {t('auth.login')}
        </Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="seu-pattern relative grid min-h-screen place-items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Suspense fallback={<Card className="p-6 text-center text-sm">…</Card>}>
          <ResetPasswordInner />
        </Suspense>
      </motion.div>
    </div>
  );
}
