"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import { Button, Input, Label, Td, Th, Toolbar, Tr } from "@/components/ui";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/seu";
import { Modal, ConfirmModal } from "@/components/modal";
import { useToast } from "@/components/seu/toast";
import { useT } from "@/i18n/i18n";

type Section = {
  id: string;
  name: string;
  faculty?: string;
  year?: number;
  capacity?: number;
};

interface SectionForm {
  name: string;
  faculty?: string;
  year?: number;
  capacity?: number;
}

const empty: SectionForm = { name: "" };

export default function SectionsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<{ open: boolean; editing?: Section }>({
    open: false,
  });
  const [form, setForm] = useState<SectionForm>(empty);
  const [confirmDel, setConfirmDel] = useState<Section | null>(null);

  const q = useQuery({
    queryKey: ["sections"],
    queryFn: () =>
      unwrapPaginated<Section>(
        api.get("/sections", { params: { page: 1, pageSize: 100 } }),
      ),
  });

  const save = useMutation({
    mutationFn: async (input: SectionForm) => {
      if (modal.editing)
        return (await api.put(`/sections/${modal.editing.id}`, input)).data;
      return (await api.post("/sections", input)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast.push({
        title: modal.editing ? t("common.saved") : t("sections.addSection"),
        tone: "success",
      });
      setModal({ open: false });
    },
    onError: (err: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: err?.message,
        tone: "error",
      }),
  });

  const del = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/sections/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast.push({ title: t("common.delete"), tone: "success" });
      setConfirmDel(null);
    },
    onError: (err: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: err?.message,
        tone: "error",
      }),
  });

  const openCreate = () => {
    setForm(empty);
    setModal({ open: true });
  };
  const openEdit = (s: Section) => {
    setForm({
      name: s.name,
      faculty: s.faculty,
      year: s.year,
      capacity: s.capacity,
    });
    setModal({ open: true, editing: s });
  };

  return (
    <>
      <PageHeader
        title={t("sections.title")}
        description={t("sections.subtitle")}
      >
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t("sections.addSection")}
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
          <TableSkeleton rows={6} cols={5} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState
            title={t("sections.empty")}
            actionLabel={t("sections.addSection")}
            onAction={openCreate}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>Faculty</Th>
                <Th className="text-right">Year</Th>
                <Th className="text-right">Capacity</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((s, i) => (
                <Tr key={s.id} index={i}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {s.faculty ?? "—"}
                  </Td>
                  <Td className="tabnum text-right text-[13.5px]">
                    {s.year ?? "—"}
                  </Td>
                  <Td className="tabnum text-right text-[13.5px]">
                    {s.capacity ?? "—"}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => openEdit(s)}
                      aria-label={t("common.edit")}
                      className="mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(s)}
                      aria-label={t("common.delete")}
                      className="rounded p-1 text-muted-foreground hover:bg-seu-red/10 hover:text-seu-red"
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

      <Modal
        open={modal.open}
        onOpenChange={(o) =>
          setModal({ open: o, editing: o ? modal.editing : undefined })
        }
        title={
          modal.editing
            ? `${t("common.edit")}: ${modal.editing.name}`
            : t("sections.addSection")
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ open: false })}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
            >
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="faculty">Faculty</Label>
            <Input
              id="faculty"
              value={form.faculty ?? ""}
              onChange={(e) =>
                setForm({ ...form, faculty: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              min={1}
              value={form.year ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  year: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="cap">Capacity</Label>
            <Input
              id="cap"
              type="number"
              min={1}
              value={form.capacity ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  capacity: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={confirmDel ? `${t("common.delete")}: ${confirmDel.name}?` : ""}
        description="This action cannot be undone."
        destructive
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (confirmDel) {
            await del.mutateAsync(confirmDel.id);
          }
        }}
      />
    </>
  );
}
