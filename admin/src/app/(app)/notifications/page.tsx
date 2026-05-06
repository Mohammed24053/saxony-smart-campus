"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, Megaphone, Layers, BookOpen, User } from "lucide-react";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { PageHeader, useToast } from "@/components/seu";
import { cn } from "@/lib/utils";

type Audience = "broadcast" | "section" | "subject" | "user";

const AUDIENCE_OPTIONS: {
  value: Audience;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  helper: string;
}[] = [
  {
    value: "broadcast",
    label: "Everyone in the university",
    icon: Megaphone,
    helper: "All users will receive this notification.",
  },
  {
    value: "section",
    label: "Section",
    icon: Layers,
    helper: "All students enrolled in this section.",
  },
  {
    value: "subject",
    label: "Subject",
    icon: BookOpen,
    helper: "Everyone (students + doctors) involved in this subject.",
  },
  {
    value: "user",
    label: "Single user",
    icon: User,
    helper: "Only the targeted user will receive it.",
  },
];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<Audience>("broadcast");
  const [target, setTarget] = useState("");

  const mu = useMutation({
    mutationFn: () =>
      api.post("/notifications/send", {
        type: "general",
        title,
        body,
        targetType: scope,
        targetId: scope === "broadcast" ? null : target,
      }),
    onSuccess: () => {
      push({
        tone: "success",
        title: "Notification sent",
        description: "Recipients will see it shortly.",
      });
      setTitle("");
      setBody("");
      setTarget("");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Send failed";
      push({ tone: "error", title: "Send failed", description: msg });
    },
  });

  const audienceMeta = AUDIENCE_OPTIONS.find((a) => a.value === scope)!;
  const AudienceIcon = audienceMeta.icon;

  return (
    <>
      <PageHeader
        title="Send notification"
        description="Reach students or doctors with broadcasts, alerts, or per-user messages."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Compose</CardTitle>
            <CardDescription>
              This will be delivered via push + in-app inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="n-title">Title</Label>
              <Input
                id="n-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lecture moved to Tuesday"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-body">Body</Label>
              <Textarea
                id="n-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a clear, friendly message…"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="audience">Audience</Label>
                <Select
                  id="audience"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Audience)}
                >
                  {AUDIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[12px] text-muted-foreground">
                  {audienceMeta.helper}
                </p>
              </div>
              {scope !== "broadcast" && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="n-target">Target ID</Label>
                  <Input
                    id="n-target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="UUID"
                  />
                </motion.div>
              )}
            </div>
            <Button
              onClick={() => mu.mutate()}
              disabled={
                mu.isPending ||
                !title.trim() ||
                !body.trim() ||
                (scope !== "broadcast" && !target.trim())
              }
              size="sm"
            >
              <Send className="h-3.5 w-3.5" />{" "}
              {mu.isPending ? "Sending…" : "Send notification"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How recipients will see it</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-card p-3 shadow-card">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-seu-red text-white">
                  <AudienceIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                    Saxony Smart Campus
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 truncate text-[13.5px] font-medium",
                      !title && "text-muted-foreground",
                    )}
                  >
                    {title || "Notification title"}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 line-clamp-3 whitespace-pre-line text-[12px]",
                      !body && "text-muted-foreground",
                    )}
                  >
                    {body || "Notification body…"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2.5 text-[12px] text-muted-foreground">
              Audience:{" "}
              <span className="font-medium text-foreground">
                {audienceMeta.label}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
