'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Select } from '@/components/ui';
import { PageHeader } from '@/components/seu';
import { useToast } from '@/components/seu/toast';
import { useT } from '@/i18n/i18n';

interface Settings {
  id: string;
  name: string;
  arabicName?: string;
  schoolYear?: string;
  weekStartsOn?: number;
  defaultLateAfterMinutes?: number;
  brandLogoUrl?: string;
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Settings>({ id: '', name: '' });

  const q = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data ?? (await api.get('/settings')).data,
  });

  useEffect(() => {
    if (q.data) setForm(q.data as Settings);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => (await api.patch('/settings', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.push({ title: t('settings.saved'), tone: 'success' });
    },
    onError: (e: { message?: string }) => toast.push({ title: t('errors.generic'), description: e?.message, tone: 'error' }),
  });

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')}>
        <Button size="sm" disabled={save.isPending || q.isLoading} onClick={() => save.mutate()}>
          {save.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.general')}</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">{t('settings.name')}</Label>
              <Input id="name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="aname">{t('settings.arabicName')}</Label>
              <Input id="aname" value={form.arabicName ?? ''} onChange={(e) => setForm({ ...form, arabicName: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label htmlFor="logo">{t('settings.brandLogoUrl')}</Label>
              <Input id="logo" type="url" value={form.brandLogoUrl ?? ''} onChange={(e) => setForm({ ...form, brandLogoUrl: e.target.value })} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.academic')}</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="year">{t('settings.schoolYear')}</Label>
              <Input id="year" placeholder="2025/2026" value={form.schoolYear ?? ''} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dow">{t('settings.weekStartsOn')}</Label>
              <Select id="dow" value={form.weekStartsOn ?? 6} onChange={(e) => setForm({ ...form, weekStartsOn: Number(e.target.value) })}>
                {dayLabels.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="late">{t('settings.defaultLateAfterMinutes')}</Label>
              <Input id="late" type="number" min={0} max={120} value={form.defaultLateAfterMinutes ?? 10} onChange={(e) => setForm({ ...form, defaultLateAfterMinutes: Number(e.target.value) })} />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
