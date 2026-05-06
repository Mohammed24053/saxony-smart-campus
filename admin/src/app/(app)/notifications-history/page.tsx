"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, Trash2 } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import { Button, Td, Th, Toolbar, Tr } from "@/components/ui";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/seu";
import { useToast } from "@/components/seu/toast";
import { useT } from "@/i18n/i18n";

interface Notification {
  id: string;
  title: string;
  body?: string;
  type?: string;
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationsHistoryPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["notifications", page],
    queryFn: () =>
      unwrapPaginated<Notification>(
        api.get("/notifications", { params: { page, pageSize: 25 } }),
      ),
  });

  const markAll = useMutation({
    mutationFn: async () => (await api.put("/notifications/read-all")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.push({ title: t("common.saved"), tone: "success" });
    },
  });

  const markOne = useMutation({
    mutationFn: async (id: string) =>
      (await api.put(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/notifications/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.history")}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
        >
          <Check className="h-3 w-3" /> Mark all read
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          {q.data && (
            <span className="ml-auto text-[12px] tabnum text-muted-foreground">
              {q.data.total.toLocaleString()} {t("common.all").toLowerCase()}
            </span>
          )}
        </Toolbar>
        {q.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            icon={<BellOff className="h-5 w-5" />}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("common.title")}</Th>
                <Th>{t("common.description")}</Th>
                <Th>{t("audit.when")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((n, i) => (
                <Tr key={n.id} index={i}>
                  <Td className="font-medium">
                    {!n.readAt && (
                      <Bell className="mr-1 inline h-3 w-3 text-seu-red" />
                    )}
                    {n.title}
                  </Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {n.body ?? "—"}
                  </Td>
                  <Td className="text-[11.5px] tabnum text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </Td>
                  <Td className="text-right">
                    {!n.readAt && (
                      <button
                        onClick={() => markOne.mutate(n.id)}
                        className="mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Mark read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => remove.mutate(n.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-seu-red/10 hover:text-seu-red"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
