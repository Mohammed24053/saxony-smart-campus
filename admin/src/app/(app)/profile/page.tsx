"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Input, Label } from "@/components/ui";
import { PageHeader } from "@/components/seu";
import { ConfirmModal } from "@/components/modal";
import { useToast } from "@/components/seu/toast";
import { useT } from "@/i18n/i18n";

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  twoFactorEnabled?: boolean;
  university?: { id: string; name: string };
}

interface SessionRow {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastUsedAt?: string;
  current?: boolean;
}

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const data = res.data as { data?: T };
  return (data && "data" in data ? data.data : (res.data as T)) as T;
}

export default function ProfilePage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => unwrap<MeResponse>(await api.get("/me")),
  });

  useEffect(() => {
    if (me.data) {
      setName(me.data.name ?? "");
      setPhone(me.data.phone ?? "");
    }
  }, [me.data]);

  const sessions = useQuery({
    queryKey: ["me", "sessions"],
    queryFn: async () => unwrap<SessionRow[]>(await api.get("/me/sessions")),
  });

  const updateProfile = useMutation({
    mutationFn: async () => (await api.patch("/me", { name, phone })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.push({ title: t("common.saved"), tone: "success" });
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  const changePassword = useMutation({
    mutationFn: async () =>
      (
        await api.post("/me/change-password", {
          currentPassword: pwdForm.current,
          newPassword: pwdForm.next,
        })
      ).data,
    onSuccess: () => {
      toast.push({ title: t("auth.changePassword"), tone: "success" });
      setPwdForm({ current: "", next: "", confirm: "" });
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  const logoutAll = useMutation({
    mutationFn: async () => (await api.delete("/me/sessions")).data,
    onSuccess: () => {
      toast.push({ title: t("profile.logoutAll"), tone: "success" });
      qc.invalidateQueries({ queryKey: ["me", "sessions"] });
    },
    onError: (e: { message?: string }) =>
      toast.push({
        title: t("errors.generic"),
        description: e?.message,
        tone: "error",
      }),
  });

  return (
    <>
      <PageHeader
        title={t("profile.title")}
        description={t("profile.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("profile.personalInfo")}
          </h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" value={me.data?.email ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="phone">{t("common.phone")}</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">{t("common.role")}</Label>
              <Input
                id="role"
                value={me.data?.role ?? ""}
                disabled
                className="font-mono text-[12px]"
              />
            </div>
            <Button
              size="sm"
              disabled={updateProfile.isPending}
              onClick={() => updateProfile.mutate()}
            >
              {updateProfile.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("profile.security")}
          </h2>
          <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t("profile.twoFactor")}</span>
              <span
                className={
                  me.data?.twoFactorEnabled
                    ? "text-status-success"
                    : "text-muted-foreground"
                }
              >
                {me.data?.twoFactorEnabled
                  ? t("profile.twoFactorOn")
                  : t("profile.twoFactorOff")}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {me.data?.twoFactorEnabled
                ? "Two-factor authentication is currently active."
                : "Enable 2FA from the Settings → Security panel (coming soon)."}
            </p>
          </div>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("auth.changePassword")}
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cur">{t("auth.currentPassword")}</Label>
              <Input
                id="cur"
                type="password"
                value={pwdForm.current}
                onChange={(e) =>
                  setPwdForm({ ...pwdForm, current: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="new">{t("auth.newPassword")}</Label>
              <Input
                id="new"
                type="password"
                value={pwdForm.next}
                onChange={(e) =>
                  setPwdForm({ ...pwdForm, next: e.target.value })
                }
                minLength={8}
              />
            </div>
            <div>
              <Label htmlFor="conf">Confirm</Label>
              <Input
                id="conf"
                type="password"
                value={pwdForm.confirm}
                onChange={(e) =>
                  setPwdForm({ ...pwdForm, confirm: e.target.value })
                }
                minLength={8}
              />
            </div>
            <Button
              size="sm"
              disabled={
                changePassword.isPending ||
                !pwdForm.current ||
                pwdForm.next.length < 8 ||
                pwdForm.next !== pwdForm.confirm
              }
              onClick={() => changePassword.mutate()}
            >
              {changePassword.isPending
                ? t("common.saving")
                : t("auth.changePassword")}
            </Button>
          </div>
        </Card>

        <Card className="p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("profile.sessions")}
            </h2>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setConfirmLogoutAll(true)}
            >
              <LogOut className="h-3 w-3" /> {t("profile.logoutAll")}
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Device
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  IP
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Last used
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.data?.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-border/60 text-[13.5px]"
                >
                  <td className="px-3 py-2">
                    <Monitor className="mr-1 inline h-3 w-3 text-muted-foreground" />{" "}
                    {s.userAgent ?? "unknown"}
                    {s.current ? " (current)" : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-muted-foreground">
                    {s.ipAddress ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.lastUsedAt
                      ? new Date(s.lastUsedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
              {sessions.data && sessions.data.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-xs text-muted-foreground"
                  >
                    No active sessions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <ConfirmModal
        open={confirmLogoutAll}
        onOpenChange={setConfirmLogoutAll}
        title={t("profile.logoutAll")}
        description={t("profile.logoutAllConfirm")}
        destructive
        confirmLabel={t("profile.logoutAll")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          await logoutAll.mutateAsync();
        }}
      />
    </>
  );
}
