import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

/**
 * Community settings (`/dashboard/s/:id/settings/*`): editable overview plus
 * the owner-only deletion zone. Both actions hit the real backend.
 */
export function ServerSettings({ serverId }: { serverId: string }) {
  const server = useQuery(api.servers.get, {
    serverId: serverId as Id<"servers">,
  });
  const update = useMutation(api.servers.update);
  const remove = useMutation(api.servers.remove);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
    rules: "",
    welcomeMessage: "",
    isPublic: true,
  });
  const [saving, setSaving] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // Seed the form whenever the query resolves or the server changes. Done
  // during render (React's supported "adjust state on prop change" pattern)
  // so switching communities never keeps the previous community's edits.
  const seedKey = server ? `${server.id}:${server.name}:${server.isPublic}` : "";
  const [seededKey, setSeededKey] = useState("");
  if (server && seededKey !== seedKey) {
    setSeededKey(seedKey);
    setForm({
      name: server.name,
      description: server.description ?? "",
      rules: server.rules ?? "",
      welcomeMessage: server.welcomeMessage ?? "",
      isPublic: server.isPublic,
    });
  }

  if (server === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canManage = hasPermission(server.permissions, PERMISSIONS.MANAGE_SERVER);

  const save = async () => {
    if (saving) return;
    if (form.name.trim().length < 2) {
      toast.error("Community names are 2–64 characters.");
      return;
    }
    setSaving(true);
    try {
      await update({
        serverId: serverId as Id<"servers">,
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        welcomeMessage: form.welcomeMessage.trim(),
        isPublic: form.isPublic,
      });
      toast.success("Community updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await remove({
        serverId: serverId as Id<"servers">,
        confirm: confirmName.trim(),
      });
      toast.success(`${server.name} was deleted.`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete community.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate(`/dashboard/s/${serverId}`)}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {server.name}
        </button>

        <h1 className="text-xl font-semibold">Community settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {server.memberCount} members ·{" "}
          {server.isOwner ? "You own this community" : "You can manage this community"}
        </p>

        {!canManage ? (
          <p className="mt-6 rounded-md border border-border/60 bg-panel p-4 text-sm text-muted-foreground">
            You don't have permission to edit this community.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-lg border border-border/60 bg-panel p-5">
              <h2 className="text-sm font-semibold">Overview</h2>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="server-name">Name</Label>
                  <Input
                    id="server-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    maxLength={64}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="server-description">Description</Label>
                  <Textarea
                    id="server-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="What is this community about?"
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="server-welcome">Welcome message</Label>
                  <Textarea
                    id="server-welcome"
                    value={form.welcomeMessage}
                    onChange={(event) =>
                      setForm({ ...form, welcomeMessage: event.target.value })
                    }
                    placeholder="Shown to new members after they join."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="server-rules">Rules</Label>
                  <Textarea
                    id="server-rules"
                    value={form.rules}
                    onChange={(event) =>
                      setForm({ ...form, rules: event.target.value })
                    }
                    placeholder="One rule per line."
                    rows={4}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Discoverable</p>
                    <p className="text-xs text-muted-foreground">
                      Anyone can find and join this community.
                    </p>
                  </div>
                  <Switch
                    checked={form.isPublic}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, isPublic: checked })
                    }
                    aria-label="Discoverable"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </section>

            {server.isOwner && (
              <section className="rounded-lg border border-destructive/40 bg-panel p-5">
                <h2 className="text-sm font-semibold text-destructive">
                  Delete community
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This permanently removes {server.name}, every channel, and all
                  messages inside it. It cannot be undone.
                </p>
                <div className="mt-3 space-y-2">
                  <Input
                    value={confirmName}
                    onChange={(event) => setConfirmName(event.target.value)}
                    placeholder={`Type “${server.name}” to confirm`}
                    aria-label="Confirm community name"
                  />
                  <Button
                    variant="destructive"
                    disabled={saving || confirmName.trim() !== server.name}
                    onClick={() => void destroy()}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete community
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
