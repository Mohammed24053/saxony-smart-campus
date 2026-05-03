'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Card } from '@/components/ui';
import { getAccessToken } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';

type Event = {
  studentId: string; studentName: string; status: 'present' | 'late' | 'absent' | 'excused';
  scannedAt: string;
};

export default function AttendanceLivePage() {
  const [sessionId, setSessionId] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    const token = getAccessToken();
    const socket: Socket = io(`${SOCKET_URL}/attendance`, {
      auth: { token },
      transports: ['websocket'],
    });
    socket.emit('session:join', { sessionId });
    socket.on('attendance:new', (ev: Event) => setEvents((prev) => [ev, ...prev].slice(0, 100)));
    socket.on('attendance:count', (c: { present: number }) => setCount(c.present));
    return () => {
      socket.emit('session:leave', { sessionId });
      socket.disconnect();
    };
  }, [sessionId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Attendance — Live</h1>
      <Card className="p-4">
        <label className="text-sm font-medium">Session ID</label>
        <input
          className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="paste session id…"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Currently present</div>
        <div className="text-4xl font-semibold">{count}</div>
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-border text-sm">
          {events.length === 0 && <li className="p-4 text-muted-foreground">Waiting for scans…</li>}
          {events.map((e, i) => (
            <li key={i} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{e.studentName}</div>
                <div className="text-xs text-muted-foreground">{e.studentId}</div>
              </div>
              <span
                className={
                  e.status === 'present'
                    ? 'rounded bg-green-100 px-2 py-1 text-xs text-green-800'
                    : e.status === 'late'
                    ? 'rounded bg-amber-100 px-2 py-1 text-xs text-amber-800'
                    : 'rounded bg-red-100 px-2 py-1 text-xs text-red-800'
                }
              >
                {e.status}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
