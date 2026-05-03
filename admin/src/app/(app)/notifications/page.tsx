'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, Input, Label } from '@/components/ui';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<'broadcast' | 'section' | 'subject' | 'user'>('broadcast');
  const [target, setTarget] = useState('');
  const [sent, setSent] = useState(false);

  const mu = useMutation({
    mutationFn: () =>
      api.post('/notifications/send', {
        type: 'general',
        title,
        body,
        targetType: scope,
        targetId: scope === 'broadcast' ? null : target,
      }),
    onSuccess: () => {
      setSent(true);
      setTitle('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Send Notification</h1>
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <textarea
            className="h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Audience</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as never)}
            >
              <option value="broadcast">Everyone in the university</option>
              <option value="section">Section</option>
              <option value="subject">Subject</option>
              <option value="user">Single user</option>
            </select>
          </div>
          {scope !== 'broadcast' && (
            <div className="space-y-2">
              <Label>Target ID</Label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="UUID" />
            </div>
          )}
        </div>
        <Button onClick={() => mu.mutate()} disabled={mu.isPending || !title || !body}>
          {mu.isPending ? 'Sending…' : 'Send'}
        </Button>
        {sent && <p className="text-sm text-green-700">Sent.</p>}
      </Card>
    </div>
  );
}
