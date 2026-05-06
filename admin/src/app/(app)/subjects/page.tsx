"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, unwrapPaginated } from "@/lib/api";
import {
  Button,
  Input,
  Label,
  Select,
  Td,
  Th,
  Toolbar,
  Tr,
} from "@/components/ui";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/seu";
import { Modal, ConfirmModal } from "@/components/modal";
import { useToast } from "@/components/seu/toast";
import { useT } from "@/i18n/i18n";

type Subject = {
  id: string;
  code: string;
  name: string;
  type: "lecture" | "lab" | "tutorial";
  hoursPerWeek?: number;
  faculty?: string;
};

interface SubjectForm {
  code: string;
  name: string;
  type: "lecture" | "lab" | "tutorial";
  faculty?: string;
  hoursPerWeek?: number;
  maxRoomCapacity?: number;
}

const empty: SubjectForm = { code: "", name: "", type: "lecture" };

export default function SubjectsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<{ open: boolean; editing?: Subject }>({
    open: false,
  });
  const [form, setForm] = useState<SubjectForm>(empty);
  const [confirmDel, setConfirmDel] = useState<Subject | null>(null);

  const q = useQuery({
    queryKey: ["subjects"],
    queryFn: () =>
      unwrapPaginated<Subject>(
        api.get("/subjects", { params: { page: 1, pageSize: 100 } }),
      ),
  });

  const save = useMutation({
    mutationFn: async (input: SubjectForm) => {
      if (modal.editing)
        return (await api.put(`/subjects/${modal.editing.id}`, input)).data;
      return (await api.post("/subjects", input)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.push({
        title: modal.editing ? t("common.saved") : t("subjects.addSubject"),
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
      (await api.delete(`/subjects/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
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
  const openEdit = (s: Subject) => {
    setForm({
      code: s.code,
      name: s.name,
      type: s.type,
      faculty: s.faculty,
      hoursPerWeek: s.hoursPerWeek,
    });
    setModal({ open: true, editing: s });
  };

  return (
    <>
      <PageHeader
        title={t("subjects.title")}
        description={t("subjects.subtitle")}
      >
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t("subjects.addSubject")}
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
          <TableSkeleton rows={6} cols={6} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState
            title={t("subjects.empty")}
            actionLabel={t("subjects.addSubject")}
            onAction={openCreate}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("subjects.code")}</Th>
                <Th>{t("common.name")}</Th>
                <Th>Faculty</Th>
                <Th>{t("rooms.type")}</Th>
                <Th className="text-right">Hours/wk</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((s, i) => (
                <Tr key={s.id} index={i}>
                  <Td className="font-mono tabnum text-[11.5px] text-muted-foreground">
                    {s.code}
                  </Td>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {s.faculty ?? "—"}
                  </Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {s.type}
                  </Td>
                  <Td className="tabnum text-right text-[13.5px]">
                    {s.hoursPerWeek ?? "—"}
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
            : t("subjects.addSubject")
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
            <Label htmlFor="code">{t("subjects.code")}</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
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
            <Label htmlFor="type">{t("rooms.type")}</Label>
            <Select
              id="type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as SubjectForm["type"],
                })
              }
            >
              <option value="lecture">Lecture</option>
              <option value="lab">Lab</option>
              <option value="tutorial">Tutorial</option>
            </Select>
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
            <Label htmlFor="hpw">Hours/wk</Label>
            <Input
              id="hpw"
              type="number"
              value={form.hoursPerWeek ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  hoursPerWeek: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="cap">Max capacity</Label>
            <Input
              id="cap"
              type="number"
              value={form.maxRoomCapacity ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxRoomCapacity: e.target.value
                    ? Number(e.target.value)
                    : undefined,
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
