"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

type Role = "admin" | "doctor" | "student";
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
};

interface UserForm {
  name: string;
  email: string;
  role: Role;
  phone?: string;
  password?: string;
}

const empty: UserForm = { name: "", email: "", role: "admin" };

export default function UsersPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [modal, setModal] = useState<{ open: boolean; editing?: User }>({
    open: false,
  });
  const [form, setForm] = useState<UserForm>(empty);
  const [confirmDel, setConfirmDel] = useState<User | null>(null);

  const q = useQuery({
    queryKey: ["users", page, search, role],
    queryFn: () =>
      unwrapPaginated<User>(
        api.get("/users", {
          params: {
            page,
            pageSize: 25,
            search: search || undefined,
            role: role || undefined,
          },
        }),
      ),
  });

  const save = useMutation({
    mutationFn: async (input: UserForm) => {
      if (modal.editing) {
        const { password: _password, ...rest } = input;
        void _password;
        return (await api.patch(`/users/${modal.editing.id}`, rest)).data;
      }
      return (await api.post("/users", input)).data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      const tempPwd = res?.data?.tempPassword ?? res?.tempPassword;
      toast.push({
        title: modal.editing ? t("common.saved") : t("users.addUser"),
        description: tempPwd
          ? t("users.tempPassword", { pwd: tempPwd })
          : undefined,
        tone: "success",
      });
      setModal({ open: false });
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.push({ title: t("common.delete"), tone: "success" });
      setConfirmDel(null);
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  const reset = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/users/${id}/reset-password`)).data,
    onSuccess: (res) => {
      const tempPwd = res?.data?.tempPassword ?? res?.tempPassword;
      toast.push({
        title: t("users.resetPassword"),
        description: tempPwd
          ? t("users.tempPassword", { pwd: tempPwd })
          : undefined,
        tone: "success",
      });
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  const openCreate = () => {
    setForm(empty);
    setModal({ open: true });
  };
  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, role: u.role, phone: u.phone });
    setModal({ open: true, editing: u });
  };

  return (
    <>
      <PageHeader title={t("users.title")} description={t("users.subtitle")}>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t("users.addUser")}
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
          <Select
            className="h-8 w-32 text-[13.5px]"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value as Role | "");
            }}
          >
            <option value="">
              {t("common.all")} {t("common.role").toLowerCase()}
            </option>
            <option value="admin">admin</option>
            <option value="doctor">doctor</option>
            <option value="student">student</option>
          </Select>
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
            title={t("users.empty")}
            actionLabel={t("users.addUser")}
            onAction={openCreate}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>{t("common.email")}</Th>
                <Th>{t("common.role")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((u, i) => (
                <Tr key={u.id} index={i}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {u.email}
                  </Td>
                  <Td className="text-[11.5px]">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {u.role}
                    </span>
                  </Td>
                  <Td className="text-[13.5px] text-muted-foreground">
                    {u.isActive === false
                      ? t("common.inactive")
                      : t("common.active")}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => reset.mutate(u.id)}
                      aria-label={t("users.resetPassword")}
                      className="mr-1 rounded p-1 text-muted-foreground hover:bg-seu-gold/20 hover:text-seu-navy"
                      title={t("users.resetPassword")}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      aria-label={t("common.edit")}
                      className="mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(u)}
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
            : t("users.addUser")
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
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="role">{t("common.role")}</Label>
            <Select
              id="role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
              disabled={!!modal.editing}
            >
              <option value="admin">admin</option>
              <option value="doctor">doctor</option>
              <option value="student">student</option>
            </Select>
          </div>
          <div className="col-span-2">
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
                minLength={8}
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
