'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, BookOpen, Building2, ClipboardCheck, Layers, MapPin, ShieldCheck, Users,
} from 'lucide-react';
import {
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Input, Label, Select, Table, Td, Textarea, Th, Tr,
} from '@/components/ui';
import {
  AnimatedNumber, AttendanceChart, ConfirmModal, FileUploadZone, FlipCounter,
  KPICard, KPIRow, KPISkeleton, PageEnter, PageHeader, Skeleton,
  StatusBadge, TableSkeleton, useToast,
} from '@/components/seu';
import { SEU } from '@/lib/seu-theme';

const SAMPLE_CHART = Array.from({ length: 14 }, (_, i) => ({
  date: `2025-04-${String(i + 1).padStart(2, '0')}`,
  rate: 60 + Math.round(Math.sin(i / 2) * 10) + (i % 4) * 2,
}));

export default function DesignSystemPage() {
  const { push } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [counter, setCounter] = useState(42);

  return (
    <PageEnter>
      <PageHeader
        title="Design system"
        description="A live preview of every primitive, composite, and animation timing used across the SEU admin."
        actions={<Button onClick={() => push({ tone: 'success', title: 'Toast fired', description: 'This is a success toast.' })}>Fire toast</Button>}
      />

      {/* Brand palette */}
      <Section title="Brand palette" hint="Extracted from the SEU logo. All UI utilities draw from these tokens.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Navy', SEU.navy],
            ['Red', SEU.red],
            ['Gold', SEU.gold],
            ['Cream', SEU.cream],
            ['Gray', SEU.gray],
            ['Status info', SEU.status.info],
          ].map(([name, hex]) => (
            <div key={name} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="h-16" style={{ backgroundColor: hex }} />
              <div className="px-3 py-2 text-xs">
                <div className="font-medium">{name}</div>
                <div className="font-mono text-muted-foreground">{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons" hint="Click any button to see the 0.96-scale press animation.">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent (gold)</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ds-input">Text input</Label>
            <Input id="ds-input" placeholder="Hello, SEU…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-select">Select</Label>
            <Select id="ds-select">
              <option>Option A</option>
              <option>Option B</option>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ds-textarea">Textarea</Label>
            <Textarea id="ds-textarea" rows={3} placeholder="Multi-line content…" />
          </div>
        </div>
      </Section>

      {/* Status badges */}
      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="present" />
          <StatusBadge tone="late" />
          <StatusBadge tone="absent" />
          <StatusBadge tone="warning_1" />
          <StatusBadge tone="warning_2" />
          <StatusBadge tone="deprivation" />
          <StatusBadge tone="info">Custom info</StatusBadge>
        </div>
      </Section>

      {/* KPI cards */}
      <Section title="KPI cards" hint="Animated count-up + staggered entrance + optional live dot or alert badge.">
        <KPIRow>
          <KPICard label="Active lectures" value={12} icon={ClipboardCheck} live />
          <KPICard label="Students online" value={341} icon={Users} />
          <KPICard label="Attendance" value={88} format={(n) => `${Math.round(n)}%`} icon={ShieldCheck} />
          <KPICard label="At-risk" value={5} icon={AlertTriangle} danger />
        </KPIRow>
      </Section>

      {/* Charts */}
      <Section title="Attendance chart" hint="Recharts area chart with brand gradient + 1000ms draw-in.">
        <Card>
          <CardContent className="pt-4">
            <AttendanceChart data={SAMPLE_CHART} />
          </CardContent>
        </Card>
      </Section>

      {/* Animated number / flip counter */}
      <Section title="Counters">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AnimatedNumber</CardTitle>
              <CardDescription>Smooth tween from 0 → value (1.2s).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold tabular-nums">
                <AnimatedNumber value={counter * 137} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>FlipCounter</CardTitle>
              <CardDescription>Per-digit flip on update (300ms each).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold tabular-nums">
                <FlipCounter value={counter} pad={4} />
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCounter((v) => Math.max(0, v - 1))}>−1</Button>
                <Button size="sm" onClick={() => setCounter((v) => v + 1)}>+1</Button>
                <Button size="sm" variant="accent" onClick={() => setCounter((v) => v + 10)}>+10</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Skeletons */}
      <Section title="Skeleton loaders" hint="Shimmer animation runs 1.5s on a loop.">
        <div className="grid gap-4 sm:grid-cols-2">
          <KPISkeleton />
          <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
        <div className="mt-4">
          <TableSkeleton rows={3} cols={4} />
        </div>
      </Section>

      {/* File upload */}
      <Section title="File upload zone" hint="Drag-and-drop with progress + brand-coloured accept state.">
        <FileUploadZone onUpload={async () => undefined} hint="Excel files up to 5MB (demo)" />
      </Section>

      {/* Modals */}
      <Section title="Confirm modal" hint="Spring entrance, navy backdrop blur.">
        <Button onClick={() => setConfirm(true)} variant="outline">Open modal</Button>
        <ConfirmModal
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this resource?"
          description="This action is irreversible. The record will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setConfirm(false);
            push({ tone: 'success', title: 'Deleted', description: 'Resource removed.' });
          }}
        />
      </Section>

      {/* Tables */}
      <Section title="Table" hint="Stagger fade-in (20ms per row) + hover lift.">
        <Table>
          <thead>
            <tr><Th>Subject</Th><Th>Code</Th><Th>Faculty</Th><Th>Hours</Th></tr>
          </thead>
          <tbody>
            {[
              { code: 'CSC101', name: 'Intro to Computing', faculty: 'Engineering', hrs: 3 },
              { code: 'MAT201', name: 'Linear Algebra', faculty: 'Sciences', hrs: 4 },
              { code: 'BUS115', name: 'Marketing 101', faculty: 'Business', hrs: 3 },
            ].map((r, i) => (
              <Tr key={r.code} index={i}>
                <Td className="font-medium">{r.name}</Td>
                <Td className="font-mono text-xs">{r.code}</Td>
                <Td className="text-muted-foreground">{r.faculty}</Td>
                <Td className="tabular-nums">{r.hrs}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      {/* Animation reference */}
      <Section title="Animation timings" hint="Reference for all motion specs in the round-2 spec.">
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr><Th>Token</Th><Th>Duration</Th><Th>Easing</Th><Th>Use</Th></tr>
                </thead>
                <tbody>
                  {[
                    ['fade-up', '220ms', 'cubic-bezier(0.22, 1, 0.36, 1)', 'Page enter (12px travel)'],
                    ['border-slide-in', '150ms', 'ease-out', 'Sidebar active border'],
                    ['count-up', '1200ms', 'cubic-bezier(0.16, 1, 0.3, 1)', 'KPI numeric tween'],
                    ['row-stagger', '18ms / row', 'ease-out', 'Table row entrance'],
                    ['scale-in', '200ms', 'spring(320, 26)', 'Modal open'],
                    ['shimmer', '1.5s loop', 'ease-in-out', 'Skeleton loaders'],
                    ['pulse-ring', '1.6s loop', 'cubic-bezier(0.4, 0, 0.6, 1)', 'Conflict pulse'],
                    ['live-dot', '1.4s loop', 'ease-in-out', 'Live indicator'],
                    ['drain', '4s', 'linear', 'Toast progress bar'],
                  ].map((row, i) => (
                    <Tr key={row[0]} index={i}>
                      {row.map((c, j) => (
                        <Td key={j} className={j === 0 ? 'font-mono text-xs' : ''}>{c}</Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Section>
    </PageEnter>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.3 }}
      className="mt-8 first:mt-0"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}
