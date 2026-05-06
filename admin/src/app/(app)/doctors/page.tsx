"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import { Button, Input, Label, Td, Th, Toolbar, Tr } from "@/components/ui";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/seu";
import { Modal, ConfirmModal } from "@/components/modal";
import { useToast } from "@/components/seu/toast";
import { useT } from "@/i18n/i18n";

type Doctor = {
  id: string;
  doctorId: string;
  name: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
};

interface DoctorForm {
  doctorId: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
}

const empty: DoctorForm = { doctorId: "", name: "" };

export default function DoctorsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing?: Doctor }>({
    open: false,
  });
  const [form, setForm] = useState<DoctorForm>(empty);
  const [confirmDel, setConfirmDel] = useState<Doctor | null>(null);

  const q = useQuery({
    queryKey: ["doctors", page, search],
    queryFn: () =>
      unwrapPaginated<Doctor>(
        api.get("/doctors", { params: { page, pageSize: 25, search } }),
      ),
  });

  const save = useMutation({
    mutationFn: async (input: DoctorForm) => {
      if (modal.editing)
        return (await api.put(`/doctors/${modal.editing.id}`, input)).data;
      return (await api.post("/doctors", input)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.push({
        title: modal.editing ? t("common.saved") : t("doctors.addDoctor"),
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
    mutationFn: async (id: string) => (await api.delete(`/doctors/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
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
  const openEdit = (d: Doctor) => {
    setForm({
      doctorId: d.doctorId,
      name: d.name,
      email: d.email,
      phone: d.phone,
    });
    setModal({ open: true, editing: d });
  };

  return (
    <>
      <PageHeader
        title={t("doctors.title")}
        description={t("doctors.subtitle")}
      >
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t("doctors.addDoctor")}
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              className="h-8 pl-8 text-[13.5px]"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
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
          <TableSkeleton rows={5} cols={4} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState
            title={t("doctors.empty")}
            actionLabel={t("doctors.addDoctor")}
            onAction={openCreate}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("doctors.doctorId")}</Th>
                <Th>{t("common.name")}</Th>
                <Th>{t("common.email")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((d, i) => (
                <Tr key={d.id} index={i}>
                  <Td className="font-mono tabnum text-[11.5px] text-muted-foreground">
                    {d.doctorId}
                  </Td>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-[13.5px]">{d.email ?? "—"}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => openEdit(d)}
                      aria-label={t("common.edit")}
                      className="mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(d)}
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

      <Modal
        open={modal.open}
        onOpenChange={(o) =>
          setModal({ open: o, editing: o ? modal.editing : undefined })
        }
        title={
          modal.editing
            ? `${t("common.edit")}: ${modal.editing.name}`
            : t("doctors.addDoctor")
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
          <div>
            <Label htmlFor="docid">{t("doctors.doctorId")}</Label>
            <Input
              id="docid"
              value={form.doctorId}
              onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <Label htmlFor="phone">{t("common.phone")}</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value || undefined })
              }
            />
          </div>
          {!modal.editing && (
            <div className="col-span-2">
              <Label htmlFor="pwd">{t("auth.password")}</Label>
              <Input
                id="pwd"
                type="password"
                value={form.password ?? ""}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value || undefined })
                }
                placeholder="Optional — auto-generated if blank"
              />
            </div>
          )}
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
