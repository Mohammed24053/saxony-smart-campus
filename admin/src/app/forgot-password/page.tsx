'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label } from '@/components/ui';
import { useT } from '@/i18n/i18n';

export default function ForgotPasswordPage() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.post('/auth/password/forgot', { email });
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? t('errors.generic');
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="seu-pattern relative grid min-h-screen place-items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-seu-red text-base font-bold text-white shadow-card">
              SE
            </div>
          </div>
          <h1 className="text-center text-[20px] font-semibold tracking-tight">{t('auth.resetPassword')}</h1>
          <p className="mb-5 mt-1 text-center text-[12.5px] text-muted-foreground">
            We&apos;ll email you a reset link.
          </p>

          {done ? (
            <div className="rounded-md border border-status-success/30 bg-status-success/10 px-3 py-3 text-sm text-status-success">
              <Mail className="mb-1 inline h-4 w-4" /> {t('auth.resetEmailSent')}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {err && (
                <p className="rounded-md border border-seu-red/30 bg-seu-red/8 px-3 py-2 text-sm text-seu-red">{err}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
                  </>
                ) : (
                  t('auth.requestReset')
                )}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-xs">
            <Link href="/login" className="text-muted-foreground hover:text-seu-red hover:underline">
              ← {t('auth.login')}
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
