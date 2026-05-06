"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import { Button, Input, Td, Th, Toolbar, Tr } from "@/components/ui";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/seu";
import { useT } from "@/i18n/i18n";

interface AuditEntry {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  actor?: { name?: string; email?: string };
}

export default function AuditLogPage() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const q = useQuery({
    queryKey: ["audit", page, action],
    queryFn: () =>
      unwrapPaginated<AuditEntry>(
        api.get("/audit", {
          params: { page, pageSize: 50, action: action || undefined },
        }),
      ),
  });

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`${t("common.search")}: action…`}
              className="h-8 pl-8 text-[13.5px]"
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
            />
          </div>
          {q.data && (
            <span className="ml-auto text-[12px] tabnum text-muted-foreground">
              {q.data.total.toLocaleString()} {t("common.all").toLowerCase()}
            </span>
          )}
        </Toolbar>
        {q.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState title={t("audit.empty")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("audit.when")}</Th>
                <Th>{t("audit.actor")}</Th>
                <Th>{t("audit.action")}</Th>
                <Th>{t("audit.entity")}</Th>
                <Th>{t("audit.ip")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((row, i) => (
                <Tr key={row.id} index={i}>
                  <Td className="text-[11.5px] tabnum text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </Td>
                  <Td className="text-[13.5px]">
                    {row.actor?.name ?? row.actor?.email ?? row.actorId ?? "—"}
                    {row.actorRole && (
                      <span className="ml-1.5 rounded bg-muted px-1 py-px font-mono text-[11px] text-muted-foreground">
                        {row.actorRole}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-[11.5px]">{row.action}</Td>
                  <Td className="text-[11.5px] text-muted-foreground">
                    {row.entity}
                    {row.entityId && (
                      <span className="ml-1 font-mono text-[11px]">
                        {row.entityId.slice(0, 8)}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-[11.5px] text-muted-foreground">
                    {row.ipAddress ?? "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {q.data && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
          <span className="tabnum">
            {q.data.total} {t("common.all").toLowerCase()}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("common.back")}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page * q.data.pageSize >= q.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
