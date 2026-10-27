import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Copy, Loader2, Plus, Trash2, X } from "@/components/icons";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { InviteDialog } from "@/components/app/dialogs";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_COLORS,
  PERMISSIONS,
  PERMISSION_META,
  hasPermission,
} from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, useUploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

type TabId = "overview" | "roles" | "invites" | "bans" | "audit" | "danger";

/**
 * Server settings (`/dashboard/s/:id/settings/*`). Every tab hits the real
 * backend: overview edits, icon/banner uploads, roles with permissions,
 * invite links, bans, the audit log and deletion.
 */
export function ServerSettings({ serverId }: { serverId: string }) {
  const server = useQuery(api.servers.get, {
    serverId: serverId as Id<"servers">,
  });
  const update = useMutation(api.servers.update);
  const remove = useMutation(api.servers.remove);
  const setVanity = useMutation(api.servers.setVanity);
  const navigate = useNavigate();
  const upload = useUploadFile();

  const [tab, setTab] = useState<TabId>("overview");
  const [form, setForm] = useState({
    name: "",
    description: "",
    rules: "",
    welcomeMessage: "",
    isPublic: true,
    tags: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"icon" | "banner" | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [vanityDraft, setVanityDraft] = useState("");
  const [vanityBusy, setVanityBusy] = useState(false);

  // Seed the form whenever the query resolves or the server changes. Done
  // during render (React's supported "adjust state on prop change" pattern)
  // so switching servers never keeps the previous server's edits.
  const seedKey = server
    ? `${server.id}:${server.name}:${server.isPublic}:${server.tags.join("|")}:${server.vanityCode ?? ""}`
    : "";
  const [seededKey, setSeededKey] = useState("");
  if (server && seededKey !== seedKey) {
    setSeededKey(seedKey);
    setForm({
      name: server.name,
      description: server.description ?? "",
      rules: server.rules ?? "",
      welcomeMessage: server.welcomeMessage ?? "",
      isPublic: server.isPublic,
      tags: [...server.tags],
    });
    setVanityDraft(server.vanityCode ?? "");
  }

  if (server === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canManage = hasPermission(server.permissions, PERMISSIONS.MANAGE_SERVER);
  const canRoles = hasPermission(server.permissions, PERMISSIONS.MANAGE_ROLES);
  const canBans = hasPermission(server.permissions, PERMISSIONS.BAN_MEMBERS);
  const canInvites = hasPermission(
    server.permissions,
    PERMISSIONS.CREATE_INVITES,
  );
  const canAudit = hasPermission(
    server.permissions,
    PERMISSIONS.VIEW_AUDIT_LOG,
  );

  const TABS: { id: TabId; label: string; show: boolean }[] = [
    { id: "overview", label: "Overview", show: canManage },
    { id: "roles", label: "Roles", show: canRoles },
    { id: "invites", label: "Invites", show: canInvites },
    { id: "bans", label: "Bans", show: canBans },
    { id: "audit", label: "Audit log", show: canAudit },
    { id: "danger", label: "Danger zone", show: server.isOwner },
  ];
  const visibleTabs = TABS.filter((entry) => entry.show);
  const activeTab = visibleTabs.some((entry) => entry.id === tab) ? tab : visibleTabs[0]?.id ?? "overview";

  const save = async () => {
    if (saving) return;
    if (form.name.trim().length < 2) {
      toast.error("Server names are 2–64 characters.");
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
        tags: form.tags,
      });
      toast.success("Server updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (
    kind: "icon" | "banner",
    file: File | undefined,
  ) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Images must be under 10 MB.");
      return;
    }
    setUploading(kind);
    try {
      const attachment = await upload(file);
      await update({
        serverId: serverId as Id<"servers">,
        [kind === "icon" ? "iconStorageId" : "bannerStorageId"]:
          attachment.storageId,
      });
      toast.success(kind === "icon" ? "Server icon updated." : "Banner updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed.",
      );
    } finally {
      setUploading(null);
    }
  };

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    if (form.tags.length >= 5) {
      toast.error("Servers can have up to 5 tags.");
      return;
    }
    if (form.tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    setForm({ ...form, tags: [...form.tags, tag] });
    setTagDraft("");
  };

  const saveVanity = async () => {
    if (vanityBusy) return;
    setVanityBusy(true);
    try {
      await setVanity({ serverId: serverId as Id<"servers">, code: vanityDraft });
      toast.success(
        vanityDraft.trim()
          ? `Custom invite link saved: /invite/${vanityDraft.trim().toLowerCase()}`
          : "Custom invite link removed.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save that link.",
      );
    } finally {
      setVanityBusy(false);
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
        error instanceof Error ? error.message : "Could not delete server.",
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

        <h1 className="text-xl font-semibold">Server settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {server.memberCount} members ·{" "}
          {server.isOwner ? "You own this server" : "You can manage this server"}
        </p>

        {visibleTabs.length > 0 && (
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border/60 pb-px">
            {visibleTabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  "shrink-0 rounded-t-md px-3 py-2 text-sm transition-colors",
                  activeTab === entry.id
                    ? "bg-panel font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "overview" && (
          <section className="mt-6 rounded-lg border border-border/60 bg-panel p-5">
            <h2 className="text-sm font-semibold">Images</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-cyan text-sm font-bold text-white">
                {server.iconUrl ? (
                  <img src={server.iconUrl} alt="" className="size-full object-cover" />
                ) : (
                  server.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-sm hover:bg-surface/70">
                {uploading === "icon" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {server.iconUrl ? "Change icon" : "Upload icon"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    void uploadImage("icon", event.target.files?.[0])
                  }
                />
              </label>
              {server.iconUrl && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void update({
                      serverId: serverId as Id<"servers">,
                      iconStorageId: null,
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="mt-4">
              <div className="h-24 w-full overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-brand to-cyan">
                {server.bannerUrl && (
                  <img
                    src={server.bannerUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-sm hover:bg-surface/70">
                {uploading === "banner" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {server.bannerUrl ? "Change banner" : "Upload banner"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    void uploadImage("banner", event.target.files?.[0])
                  }
                />
              </label>
              {server.bannerUrl && (
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() =>
                    void update({
                      serverId: serverId as Id<"servers">,
                      bannerStorageId: null,
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </div>

            <h2 className="mt-7 text-sm font-semibold">Overview</h2>
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
                  placeholder="What is this server about?"
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
                    Anyone can find and join this server.
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

              {/* Preview stats: exactly what Discovery cards show. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 bg-surface px-3 py-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-success" />
                  {server.onlineCount} online
                </span>
                <span>{server.memberCount} members</span>
                <span>
                  Est. {new Date(server.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>

            <h2 className="mt-7 text-sm font-semibold">Discovery tags</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              How your server appears in invite links and Discovery. People
              search these — up to 5.
            </p>
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface px-2.5 py-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() =>
                        setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {form.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No tags yet — add a few below.
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="e.g. gaming, coding, chill"
                  maxLength={24}
                  className="flex-1"
                  aria-label="New tag"
                />
                <Button variant="outline" onClick={addTag}>
                  <Plus className="mr-1 size-4" /> Add tag
                </Button>
              </div>
            </div>

            <h2 className="mt-7 text-sm font-semibold">Custom invite link</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a memorable link for your server. Letters, numbers, dashes
              and underscores.
            </p>
            <div className="mt-3 rounded-md border border-border/60 bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {typeof window !== "undefined" ? window.location.origin : ""}/invite/
                </span>
                <Input
                  value={vanityDraft}
                  onChange={(event) =>
                    setVanityDraft(event.target.value.toLowerCase())
                  }
                  placeholder="my-server"
                  maxLength={24}
                  className="h-8 w-44 flex-1"
                  aria-label="Custom invite code"
                />
                <Button
                  size="sm"
                  onClick={() => void saveVanity()}
                  disabled={
                    vanityBusy ||
                    (vanityDraft ?? "") === (server.vanityCode ?? "")
                  }
                >
                  {vanityBusy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                  Save link
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {server.vanityCode
                    ? `Current: ${window.location.origin}/invite/${server.vanityCode}`
                    : "No custom link yet — your default invite code still works."}
                </span>
                {server.vanityCode && (
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`${window.location.origin}/invite/${server.vanityCode}`)
                        .then(() => toast.success("Link copied."))
                        .catch(() => toast.error("Clipboard access was blocked by the browser."));
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </section>
        )}

        {activeTab === "roles" && (
          <RolesTab
            serverId={serverId}
            isOwner={server.isOwner}
            canManageRoles={canRoles}
          />
        )}

        {activeTab === "invites" && (
          <section className="mt-6 rounded-lg border border-border/60 bg-panel p-5">
            <h2 className="text-sm font-semibold">Invite links</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create invite links with expiry and use limits, then share them
              with the people you want in this server.
            </p>
            <div className="mt-3">
              <InvitesInline serverId={serverId} />
            </div>
          </section>
        )}

        {activeTab === "bans" && <BansTab serverId={serverId} />}

        {activeTab === "audit" && <AuditTab serverId={serverId} />}

        {activeTab === "danger" && server.isOwner && (
          <section className="mt-6 rounded-lg border border-destructive/40 bg-panel p-5">
            <h2 className="text-sm font-semibold text-destructive">
              Delete server
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
                aria-label="Confirm server name"
              />
              <Button
                variant="destructive"
                disabled={saving || confirmName.trim() !== server.name}
                onClick={() => void destroy()}
              >
                <Trash2 className="mr-2 size-4" />
                Delete server
              </Button>
            </div>
          </section>
        )}

        {visibleTabs.length === 0 && (
          <p className="mt-6 rounded-md border border-border/60 bg-panel p-4 text-sm text-muted-foreground">
            You don't have permission to manage this server.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

/** Checkbox list of every permission bit, with the admin shortcut. */
function PermissionToggles({
  value,
  onChange,
  allowAdmin,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  allowAdmin: boolean;
}) {
  return (
    <div className="grid gap-2">
      {ALL_PERMISSIONS.map((permission) => {
        const meta = PERMISSION_META[permission];
        const isAdmin = permission === PERMISSIONS.ADMINISTRATOR;
        if (isAdmin && !allowAdmin) return null;
        return (
          <label
            key={permission}
            className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{meta.label}</span>
              <span className="block text-xs text-muted-foreground">
                {meta.description}
              </span>
            </span>
            <Switch
              checked={value.includes(permission)}
              onCheckedChange={(checked) => {
                if (isAdmin) {
                  onChange(checked ? [PERMISSIONS.ADMINISTRATOR] : []);
                  return;
                }
                const base = value.filter(
                  (entry) =>
                    entry !== permission &&
                    entry !== PERMISSIONS.ADMINISTRATOR,
                );
                onChange(checked ? [...base, permission] : base);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

function RolesTab({
  serverId,
  isOwner,
  canManageRoles,
}: {
  serverId: string;
  isOwner: boolean;
  canManageRoles: boolean;
}) {
  const roles = useQuery(api.roles.list, {
    serverId: serverId as Id<"servers">,
  });
  const createRole = useMutation(api.roles.create);
  const updateRole = useMutation(api.roles.update);
  const deleteRole = useMutation(api.roles.remove);

  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_ROLE_COLORS[0]);
  const [permissions, setPermissions] = useState<string[]>([
    PERMISSIONS.SEND_MESSAGES,
  ]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const run = async (action: Promise<unknown>, success?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action;
      if (success) toast.success(success);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That didn't work.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canManageRoles) {
    return (
      <section className="mt-6 rounded-lg border border-border/60 bg-panel p-5 text-sm text-muted-foreground">
        You don't have permission to manage roles.
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-lg border border-border/60 bg-panel p-5">
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles decide what members can do and how their name is coloured.
          Higher roles sit below the owner.
        </p>

        <div className="mt-4 space-y-2">
          {roles === undefined ? (
            <p className="text-sm text-muted-foreground">Loading roles…</p>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: role.color ?? "#9CA3AF" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {role.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {role.permissions.includes(PERMISSIONS.ADMINISTRATOR)
                      ? "Administrator"
                      : `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"}`}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(editingId === role.id ? null : role.id);
                    setEditPerms([...role.permissions]);
                  }}
                >
                  Edit
                </Button>
                {!role.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${role.name}`}
                    onClick={() =>
                      void run(
                        deleteRole({ roleId: role.id as Id<"serverRoles"> }),
                        "Role deleted.",
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {editingId && (
          <div className="mt-4 rounded-md border border-primary/40 bg-surface p-4">
            <h3 className="text-sm font-medium">Edit role permissions</h3>
            <div className="mt-3">
              <PermissionToggles
                value={editPerms}
                onChange={setEditPerms}
                allowAdmin={isOwner}
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEditingId(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    updateRole({
                      roleId: editingId as Id<"serverRoles">,
                      permissions: editPerms,
                    }).then(() => setEditingId(null)),
                    "Role updated.",
                  )
                }
              >
                Save permissions
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-panel p-5">
        <h2 className="text-sm font-semibold">Create a role</h2>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Moderators"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_ROLE_COLORS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-label={`Colour ${entry}`}
                  onClick={() => setColor(entry)}
                  className={cn(
                    "size-7 rounded-full transition-transform",
                    color === entry
                      ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-panel"
                      : "hover:scale-105",
                  )}
                  style={{ background: entry }}
                />
              ))}
            </div>
          </div>
          <PermissionToggles
            value={permissions}
            onChange={setPermissions}
            allowAdmin={isOwner}
          />
          <div className="flex justify-end">
            <Button
              disabled={busy || name.trim().length < 2}
              onClick={() =>
                void run(
                  createRole({
                    serverId: serverId as Id<"servers">,
                    name: name.trim(),
                    color,
                    permissions,
                  }).then(() => {
                    setName("");
                    setPermissions([PERMISSIONS.SEND_MESSAGES]);
                  }),
                  "Role created.",
                )
              }
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Create role
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Invites                                                             */
/* ------------------------------------------------------------------ */

/** Invite manager rendered inline on its own settings tab. */
function InvitesInline({ serverId }: { serverId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Manage invite links
      </Button>
      <InviteDialog
        serverId={serverId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bans                                                                */
/* ------------------------------------------------------------------ */

function BansTab({ serverId }: { serverId: string }) {
  const bans = useQuery(api.servers.listBans, {
    serverId: serverId as Id<"servers">,
  });
  const unban = useMutation(api.servers.unban);

  return (
    <section className="mt-6 rounded-lg border border-border/60 bg-panel p-5">
      <h2 className="text-sm font-semibold">Bans</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Banned members can't rejoin until you lift the ban.
      </p>
      <div className="mt-4 space-y-2">
        {bans === undefined ? (
          <p className="text-sm text-muted-foreground">Loading bans…</p>
        ) : bans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bans in this server.</p>
        ) : (
          bans.map((ban) => (
            <div
              key={ban.userId}
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {ban.user?.name ?? "Unknown user"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ban.reason ? `Reason: ${ban.reason} · ` : ""}
                  {new Date(ban.createdAt).toLocaleDateString()}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void unban({
                    serverId: serverId as Id<"servers">,
                    userId: ban.userId as Id<"users">,
                  })
                    .then(() => toast.success("Member unbanned."))
                    .catch((error: unknown) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not unban.",
                      ),
                    )
                }
              >
                Unban
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

function AuditTab({ serverId }: { serverId: string }) {
  const entries = useQuery(api.servers.auditLog, {
    serverId: serverId as Id<"servers">,
  });

  return (
    <section className="mt-6 rounded-lg border border-border/60 bg-panel p-5">
      <h2 className="text-sm font-semibold">Audit log</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The last 60 administrative actions in this server.
      </p>
      <div className="mt-4 space-y-2">
        {entries === undefined ? (
          <p className="text-sm text-muted-foreground">Loading audit log…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border border-border/60 px-3 py-2"
            >
              <p className="text-sm">
                <span className="font-medium">
                  {entry.actor?.name ?? "Someone"}
                </span>{" "}
                <span className="text-muted-foreground">{entry.action}</span>
              </p>
              {entry.details && (
                <p className="text-xs text-muted-foreground">{entry.details}</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
