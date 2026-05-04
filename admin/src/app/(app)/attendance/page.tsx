'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import { Activity, Radio, Users } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { FlipCounter, PageHeader, StatusBadge } from '@/components/seu';
import { getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';

type Event = {
  studentId: string;
  studentName: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  scannedAt: string;
};

type StatusTone = 'present' | 'late' | 'absent' | 'info';
function statusTone(s: Event['status']): StatusTone {
  if (s === 'present') return 'present';
  if (s === 'late') return 'late';
  if (s === 'absent') return 'absent';
  return 'info';
}

export default function AttendanceLivePage() {
  const [sessionId, setSessionId] = useState('');
  const [active, setActive] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [count, setCount] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!active || !sessionId) return;
    const token = getAccessToken();
    const socket: Socket = io(`${SOCKET_URL}/attendance`, {
      auth: { token },
      transports: ['websocket'],
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('session:join', { sessionId });
    socket.on('attendance:new', (ev: Event) => setEvents((prev) => [ev, ...prev].slice(0, 100)));
    socket.on('attendance:count', (c: { present: number }) => setCount(c.present));
    return () => {
      socket.emit('session:leave', { sessionId });
      socket.disconnect();
      setConnected(false);
    };
  }, [active, sessionId]);

  return (
    <>
      <PageHeader
        title="Attendance — Live"
        description="Watch scans land in real time as students check in."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: session + counter */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="session-id">Session ID</Label>
                <Input
                  id="session-id"
                  placeholder="paste session id…"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  disabled={active}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  variant={active ? 'outline' : 'default'}
                  disabled={!sessionId.trim()}
                  onClick={() => {
                    setActive((a) => !a);
                    setEvents([]);
                    setCount(0);
                  }}
                >
                  {active ? 'Stop' : 'Watch session'}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    connected ? 'bg-status-success animate-live-dot' : 'bg-muted',
                  )}
                />
                <span className="text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-seu-red" /> Currently present
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-semibold tracking-tight text-foreground">
                <FlipCounter value={count} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Counts update instantly as scans are accepted.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column: live feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-seu-red" /> Live feed
              </CardTitle>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5" /> {events.length} scan{events.length === 1 ? '' : 's'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {events.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Waiting for scans…
                </li>
              )}
              <AnimatePresence initial={false}>
                {events.map((e, i) => (
                  <motion.li
                    key={`${e.studentId}-${e.scannedAt}-${i}`}
                    initial={{ opacity: 0, x: 24, backgroundColor: 'rgba(46, 125, 50, 0.18)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(46, 125, 50, 0)' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    layout
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{e.studentName}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{e.studentId}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(e.scannedAt).toLocaleTimeString()}
                      </span>
                      <StatusBadge tone={statusTone(e.status)} />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
