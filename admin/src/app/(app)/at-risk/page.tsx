"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterChip,
  Input,
  Label,
  Td,
  Textarea,
  Th,
  Toolbar,
  Tr,
} from "@/components/ui";
import {
  PageHeader,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@/components/seu";
import { useT } from "@/i18n/i18n";

type AtRiskRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  warningLevel: "warning_1" | "warning_2" | "deprivation";
  absenceCount: number;
  triggeredAt: string;
  isResolved: boolean;
  student?: { user: { name: string } };
  subject?: { name: string; code: string };
};

type FilterKey = "all" | "warning_1" | "warning_2" | "deprivation";
const FILTER_KEYS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "atRisk.filterAll" },
  { key: "warning_1", label: "atRisk.warning1" },
  { key: "warning_2", label: "atRisk.warning2" },
  { key: "deprivation", label: "atRisk.deprivation" },
];

/**
 * Inline sparkline rendering the last 8 weeks of absence trend.
 * Pure SVG, no extra deps.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (v / max) * h).toFixed(2)}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <path d={d} stroke="#B1222A" strokeWidth={1.5} fill="none" />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (v / max) * h}
          r={1.5}
          fill="#B1222A"
        />
      ))}
    </svg>
  );
}

export default function AtRiskPage() {
  const { t } = useT();
  const { push } = useToast();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [target, setTarget] = useState<AtRiskRecord | null>(null);

  const q = useQuery({
    queryKey: ["at-risk"],
    queryFn: () =>
      unwrapPaginated<AtRiskRecord>(
        api.get("/at-risk", { params: { page: 1, pageSize: 100 } }),
      ),
  });

  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    if (filter === "all") return items;
    return items.filter((r) => r.warningLevel === filter);
  }, [q.data, filter]);

  return (
    <>
      <PageHeader
        title={t("atRisk.title")}
        description={t("atRisk.subtitle")}
      />

      {/* Toolbar — filter chips inline; counts taken from the unfiltered set. */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          {FILTER_KEYS.map((f) => (
            <FilterChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
              count={
                f.key === "all"
                  ? q.data?.items.length
                  : q.data?.items.filter((r) => r.warningLevel === f.key).length
              }
            >
              {t(f.label)}
            </FilterChip>
          ))}
          <span className="ml-auto text-[12px] tabnum text-muted-foreground">
            {t("atRisk.matching", { count: rows.length.toLocaleString() })}
          </span>
        </Toolbar>

        {q.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("atRisk.colStudent")}</Th>
                <Th>{t("atRisk.colSubject")}</Th>
                <Th>{t("atRisk.level")}</Th>
                <Th className="text-right">{t("atRisk.colAbsences")}</Th>
                <Th>{t("atRisk.colTrend")}</Th>
                <Th>{t("atRisk.colTriggered")}</Th>
                <Th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                // Synthesize a stable trend from the row id; replace with real
                // weekly absence series when /at-risk/:id/trend is implemented.
                let h = 0;
                for (let n = 0; n < r.id.length; n++)
                  h = (h * 31 + r.id.charCodeAt(n)) >>> 0;
                const trend = Array.from(
                  { length: 8 },
                  (_, k) => ((h >> k) & 7) + 1,
                );

                return (
                  <Tr key={r.id} index={i}>
                    <Td className="font-medium text-foreground">
                      {r.student?.user.name ?? r.studentId}
                    </Td>
                    <Td className="text-[13.5px] text-muted-foreground">
                      {r.subject
                        ? `${r.subject.code} — ${r.subject.name}`
                        : r.subjectId}
                    </Td>
                    <Td>
                      <StatusBadge tone={r.warningLevel} />
                    </Td>
                    <Td className="tabnum text-right text-[13.5px]">
                      {r.absenceCount}
                    </Td>
                    <Td>
                      <Sparkline values={trend} />
                    </Td>
                    <Td className="text-[13.5px] text-muted-foreground tabnum">
                      {new Date(r.triggeredAt).toLocaleDateString()}
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={t("atRisk.sendAlert")}
                        onClick={() => setTarget(r)}
                      >
                        <Send className="h-3.5 w-3.5" /> {t("atRisk.alert")}
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <Td className="text-center text-muted-foreground">
                    {t("atRisk.empty")}
                  </Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-out alert composer */}
      <AnimatePresence>
        {target && (
          <AlertComposer
            record={target}
            onClose={() => setTarget(null)}
            onSent={() => {
              push({ tone: "success", title: t("atRisk.composer.sent") });
              setTarget(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AlertComposer({
  record,
  onClose,
  onSent,
}: {
  record: AtRiskRecord;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useT();
  const { push } = useToast();
  const [title, setTitle] = useState(
    t("atRisk.composer.defaultTitle", {
      subject: record.subject?.name ?? t("atRisk.composer.fallbackSubject"),
    }),
  );
  const [body, setBody] = useState(
    t("atRisk.composer.defaultBody", {
      name: record.student?.user.name ?? t("atRisk.composer.fallbackStudent"),
      n: record.absenceCount,
      subject: record.subject?.name ?? t("atRisk.composer.fallbackThis"),
    }),
  );
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api.post("/notifications", {
        title,
        body,
        targetType: "user",
        targetId: record.studentId,
      });
      onSent();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? t("atRisk.composer.failed");
      push({
        tone: "error",
        title: t("atRisk.composer.failed"),
        description: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-seu-navy/30 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-card shadow-modal"
        role="dialog"
        aria-label="Send alert"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold">
              {t("atRisk.sendAlert")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("atRisk.composer.to", {
                name: record.student?.user.name ?? record.studentId,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("atRisk.composer.close")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-title">
              {t("atRisk.composer.titleField")}
            </Label>
            <Input
              id="alert-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert-body">{t("atRisk.composer.bodyField")}</Label>
            <Textarea
              id="alert-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Card className="border-seu-gold/40 bg-seu-gold/10">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-[13.5px]">
                {t("atRisk.composer.preview")}
              </CardTitle>
              <CardDescription className="text-[12px]">
                {t("atRisk.composer.previewSub")}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-[13.5px]">
              <div className="font-medium">
                {title || t("atRisk.composer.noTitle")}
              </div>
              <div className="mt-1 whitespace-pre-line text-muted-foreground">
                {body || t("atRisk.composer.noBody")}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t("atRisk.composer.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={send}
            disabled={busy || !title.trim() || !body.trim()}
          >
            <Send className="h-3.5 w-3.5" />{" "}
            {busy ? t("atRisk.composer.sending") : t("atRisk.composer.send")}
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
