'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Button, Card, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@saxony-egypt.edu');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Smart Campus Admin</h1>
        <p className="mb-6 text-sm text-muted-foreground">Saxony Egypt University</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {needs2fa && (
            <div className="space-y-2">
              <Label htmlFor="code">2FA Code</Label>
              <Input id="code" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                     value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
