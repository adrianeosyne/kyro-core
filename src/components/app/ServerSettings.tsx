import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Bold,
  Monitor,
  Download,
  Eye,
  Loader2,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Sun,
} from "@/components/icons";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { UserAvatar } from "@/components/app/UserAvatar";
import { ConfirmDangerDialog } from "@/components/app/dialogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useUiStore, type AccentChoice, type Density, type ThemeChoice } from "@/lib/store";
import { MAX_UPLOAD_BYTES, useUploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

type TabId =
  | "overview"
  | "roles"
  | "moderation"
  | "settings"
  | "account"
  | "profile"
  | "appearance"
  | "privacy"
  | "security"
  | "data";

const TABS: { id: TabId; label: string; icon: typeof UserIcon }[] = [
  { id: "overview", label: "Overview", icon: UserIcon },
  { id: "roles", label: "Roles", icon: Palette },
  { id: "moderation", label: "Moderation", icon: Bold },
  { id: "settings", label: "Settings", icon: Bold },
  { id: "account", label: "My account", icon: UserIcon },
  { id: "profile", label: "Profile", icon: Palette },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "privacy", label: "Privacy & safety", icon: ShieldCheck },
  { id: "security", label: "Sessions", icon: Bold },
  { id: "data", label: "Data", icon: Download },
];

const ACCENTS: { id: AccentChoice; label: string; color: string }[] = [
  { id: "default", label: "Blurple", color: "#5865F2" },
  { id: "cyan", label: "Cyan", color: "#0E9FD8" },
  { id: "violet", label: "Violet", color: "#8B5CF6" },
  { id: "emerald", label: "Emerald", color: "#10B981" },
  { id: "rose", label: "Rose", color: "#F43F5E" },
  { id: "amber", label: "Amber", color: "#F59E0B" },
];

/** Shared shape of the server profile payload returned by `servers.get`. */
interface ServerProfile {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  welcomeMessage: string | null;
  isPublic: boolean;
  ownerId: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  isOwner: boolean;
  muted: boolean;
  nickname: string | null;
  permissions: string[];
  roles: { id: string; name: string; color: string | null; position: number; isDefault: boolean; permissions: string[] }[];
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mb-3 mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className={cn(!description && "mt-3")}>{children}</div>
    </section>
  );
}

function OverviewTab({ server }: { server: ServerProfile }) {
  const update = useMutation(api.servers.update);
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? "");
  const [rules, setRules] = useState(server.rules ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(server.welcomeMessage ?? "");
  const [isPublic, setIsPublic] = useState(server.isPublic);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await update({
        serverId: server.id as Id<"servers">,
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        welcomeMessage: welcomeMessage.trim() || undefined,
        isPublic,
      });
      sonnerToast.success("Community updated.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section title="Overview">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="server-name">Name</Label>
            <Input id="server-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="server-description">Description</Label>
            <Textarea id="server-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="server-welcome">Welcome message</Label>
            <Textarea id="server-welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="server-rules">Rules</Label>
            <Textarea id="server-rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder="One rule per line." />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Discoverable</p>
              <p className="text-xs text-muted-foreground">Anyone can find and join this community.</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Discoverable" />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

function RolesTab({ server }: { server: ServerProfile }) {
  const create = useMutation((api as any).roles.create);
  const update = useMutation((api as any).roles.update);
  const remove = useMutation((api as any).roles.remove);
  const list = useQuery((api as any).roles.list, { serverId: server.id as Id<"servers"> });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5865F2");
  const [permissions, setPermissions] = useState<string[]>(["send_messages", "create_invites"]);
  const [busy, setBusy] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const roleMeta = {
    send_messages: "Send messages",
    manage_channels: "Manage channels",
    manage_roles: "Manage roles",
    manage_messages: "Manage messages",
    kick_members: "Kick members",
    ban_members: "Ban members",
    create_invites: "Create invites",
    manage_server: "Manage community",
    view_audit_log: "View audit log",
    administrator: "Administrator",
  };

  const togglePermission = (perm: string) =>
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));

  const addRole = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({
        serverId: server.id as Id<"servers">,
        name: name.trim(),
        color,
        permissions,
      });
      setName("");
      setColor("#5865F2");
      setPermissions(["send_messages", "create_invites"]);
      sonnerToast.success("Role created.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not create role.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (role: (typeof server.roles)[number]) => {
    setEditingRoleId(role.id);
    setEditName(role.name);
    setEditColor(role.color ?? "#5865F2");
    setEditPermissions([...role.permissions]);
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      await update({
        roleId: editingRoleId as Id<"serverRoles">,
        name: editName.trim(),
        color: editColor || undefined,
        permissions: editPermissions,
      });
      setEditingRoleId(null);
      sonnerToast.success("Role updated.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not update role.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (roleId: string) => {
    setDeletingRoleId(roleId);
    try {
      await remove({ roleId: roleId as Id<"serverRoles"> });
      setDeletingRoleId(null);
      sonnerToast.success("Role deleted.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not delete role.");
      setDeletingRoleId(null);
    }
  };

  return (
    <>
      <Section title="Role management" description="Create roles and assign them to members. Only people with the right permissions can do this.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Trust & moderation" maxLength={60} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-color">Color</Label>
            <Input id="role-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <Button onClick={addRole} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create role
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((perm) => (
            <button
              key={perm}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                permissions.includes(perm) ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-surface text-muted-foreground hover:text-foreground",
              )}
              onClick={() => togglePermission(perm)}
            >
              {roleMeta[perm as keyof typeof roleMeta] ?? perm}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Roles">
        <div className="space-y-2">
          {list?.map((role) => (
            <div key={role.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3">
              <span className="h-3 w-3 rounded-full" style={{ background: role.color ?? "#5865F2" }} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{role.name}</p>
                <p className="truncate text-xs text-muted-foreground">{role.permissions.map((p) => roleMeta[p as keyof typeof roleMeta] ?? p).join(", ")}</p>
              </div>
              {editingRoleId === role.id ? (
                <div className="flex gap-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-36" onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                  <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-10" />
                  <Button size="sm" onClick={saveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingRoleId(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(role)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirmDelete(role.id)} disabled={deletingRoleId === role.id}>
                    {deletingRoleId === role.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              )}
            </div>
          ))}
          {list?.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}
        </div>
      </Section>
    </>
  );
}

function ModerationTab({ server }: { server: ServerProfile }) {
  const ban = useMutation(api.servers.ban);
  const unban = useMutation(api.servers.unban);
  const kick = useMutation(api.servers.kick);
  const listBans = useQuery(api.servers.listBans, { serverId: server.id as Id<"servers"> });
  const auditLog = useQuery(api.servers.auditLog, { serverId: server.id as Id<"servers"> });
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");

  const banMember = async (userId: string) => {
    if (!target.trim()) return;
    try {
      await ban({ serverId: server.id as Id<"servers">, userId: userId as Id<"users">, reason: target });
      setTarget("");
      setReason("");
      sonnerToast.success("Member banned.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not ban.");
    }
  };

  const kickMember = async (userId: string) => {
    if (!target.trim()) return;
    try {
      await kick({ serverId: server.id as Id<"servers">, userId: userId as Id<"users">, reason: target });
      setTarget("");
      sonnerToast.success("Member kicked.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not kick.");
    }
  };

  return (
    <>
      <Section title="Kick & ban members" description="Remove or ban members. Banned users cannot rejoin.">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search member name or ID"
            value={target}
            onChange={(e) => setTarget((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && void banMember(e.target.value.toLowerCase())}
          />
          <div className="flex gap-1">
            onChange={(e) => setReason((e.target as HTMLInputElement).value)}
            <Button size="sm" variant="outline" disabled>
              Kick
            </Button>
            <Button size="sm" variant="destructive" disabled>
              Ban
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Banned members">
        <div className="space-y-2">
          {listBans?.map((ban) => ban.user && (
            <div key={ban.userId} className="flex items-center justify-between rounded-lg border border-border/60 bg-surface px-3 py-2">
              <div>
                <p className="text-sm font-medium">{ban.user.name}</p>
                <p className="text-xs text-muted-foreground">@{ban.user.username}</p>
              </div>
              <div className="flex gap-2">
                <Input value={ban.reason ?? ""} readOnly className="w-40" />
                <Button size="sm" variant="destructive" onClick={() => void unban({ serverId: server.id as Id<"servers">, userId: ban.userId as Id<"users"> })}>Unban</Button>
              </div>
            </div>
          ))}
          {listBans?.length === 0 && <p className="text-sm text-muted-foreground">No bans.</p>}
        </div>
      </Section>

      <Section title="Audit log">
        <div className="max-h-40 overflow-y-auto space-y-1">
          {auditLog?.map((entry) => entry.actor && (
            <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{entry.action}</span>
              <span className="text-muted-foreground/60">by {entry.actor.name}</span>
              <span className="text-muted-foreground/60">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {auditLog?.length === 0 && <p className="text-sm text-muted-foreground">No audit entries.</p>}
        </div>
      </Section>
    </>
  );
}

function SettingsTab({ server }: { server: ServerProfile }) {
  const setMuted = useMutation(api.servers.setMuted);
  const [muted, setMutedState] = useState(server.muted);

  const saveMuted = async () => {
    await setMuted({ serverId: server.id as Id<"servers">, muted });
  };

  return (
    <>
      <Section title="Notifications">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={muted} onCheckedChange={setMutedState} aria-label="Mute notifications" />
            <label className="text-sm text-muted-foreground">Mute notifications for this community</label>
          </div>
        </div>
      </Section>
    </>
  );
}

function AccountTab() {
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimProfile);
  const { signOut } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const value = username ?? me.username ?? "";

  return (
    <>
      <Section title="My account" description="How you appear across Kyro.">
        <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-surface p-4">
          <UserAvatar user={me} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{me.name}</p>
            <p className="truncate text-sm text-muted-foreground">@{me.username}</p>
            <p className="truncate text-xs text-muted-foreground">{me.email ?? "No email on file"}</p>
          </div>
        </div>
      </Section>

      <Section title="Username" description="Usernames can be changed once every 30 days.">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-2">
            <Label htmlFor="settings-username">Username</Label>
            <Input id="settings-username" value={value} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={32} className="w-64" />
          </div>
          <Button disabled={busy || value.length < 3 || value === me.username} onClick={async () => {
            setBusy(true);
            try {
              await claim({ username: value, name: me.name });
              sonnerToast.success("Username updated.");
              setUsername(null);
            } catch (error) {
              sonnerToast.error(error instanceof Error ? error.message : "Could not update username.");
            } finally {
              setBusy(false);
            }
          }}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </Section>

      <Section title="Session">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </Section>
    </>
  );
}

function ProfileTab() {
  const me = useQuery(api.users.me);
  const update = useMutation(api.users.updateProfile);
  const upload = useUploadFile();
  const [name, setName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const save = async () => {
    setBusy(true);
    try {
      await update({
        name: name ?? undefined,
        bio: bio ?? undefined,
        customStatus: status ?? undefined,
        accent: undefined,
      });
      sonnerToast.success("Profile saved.");
      setName(null);
      setBio(null);
      setStatus(null);
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Avatar">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar user={me} size="lg" />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-sm hover:bg-surface/70">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <UserIcon className="size-4" />}
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  if (file.size > MAX_UPLOAD_BYTES) {
                    sonnerToast.error("Images must be under 10 MB.");
                    return;
                  }
                  setUploading(true);
                  try {
                    const attachment = await upload(file);
                    await update({ avatarStorageId: attachment.storageId });
                    sonnerToast.success("Avatar updated.");
                  } catch (error) {
                    sonnerToast.error(error instanceof Error ? error.message : "Upload failed.");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {me.avatarUrl && (
              <Button variant="outline" onClick={() => void update({ avatarStorageId: null })}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Profile">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input id="profile-name" value={name ?? me.name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-status">Custom status</Label>
            <Input id="profile-status" value={status ?? me.customStatus ?? ""} onChange={(e) => setStatus(e.target.value)} placeholder="Grinding ranked" maxLength={100} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio">About me</Label>
            <Textarea id="profile-bio" rows={3} value={bio ?? me.bio ?? ""} onChange={(e) => setBio(e.target.value)} maxLength={400} />
          </div>
          <div>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

function AppearanceTab() {
  const theme = useUiStore((state) => state.theme);
  const accent = useUiStore((state) => state.accent);
  const density = useUiStore((state) => state.density);
  const showMemberList = useUiStore((state) => state.showMemberList);
  const setPreference = useUiStore((state) => state.setPreference);

  const themes: { id: ThemeChoice; label: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <>
      <Section title="Theme" description="Kyro is dark by default, with a full light mode and system matching.">
        <div className="flex flex-wrap gap-2">
          {themes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPreference("theme", entry.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                theme === entry.id ? "border-primary bg-primary/10 text-foreground" : "border-border/70 bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              <entry.icon className="size-4" />
              {entry.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent colour">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-label={entry.label}
              onClick={() => setPreference("accent", entry.id)}
              className={cn(
                "size-9 rounded-full transition-transform",
                accent === entry.id ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-105",
              )}
              style={{ background: entry.color }}
            />
          ))}
        </div>
      </Section>

      <Section title="Interface density" description="Tighter rows fit more of a conversation on screen.">
        <div className="flex gap-2">
          {(["comfortable", "compact"] as Density[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setPreference("density", entry)}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors",
                density === entry ? "border-primary bg-primary/10" : "border-border/70 bg-surface text-muted-foreground",
              )}
            >
              {entry}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Layout">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
          <span className="text-sm">Show the member list by default</span>
          <Switch checked={showMemberList} onCheckedChange={(checked) => setPreference("showMemberList", checked)} />
        </label>
      </Section>
    </>
  );
}

function PrivacyTab() {
  const me = useQuery(api.users.me);
  const update = useMutation(api.users.updatePrivacy);

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <Section title="Direct messages" description="Enforced on the server, not just in the interface.">
        <div className="flex flex-wrap gap-2">
          {(["everyone", "friends", "nobody"] as const).map((policy) => (
            <button
              key={policy}
              type="button"
              onClick={() => void update({ dmPolicy: policy })}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors",
                me.dmPolicy === policy ? "border-primary bg-primary/10" : "border-border/70 bg-surface text-muted-foreground",
              )}
            >
              {policy === "nobody" ? "No one" : policy}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Who can interact with you">
        <div className="grid gap-3">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
            <span className="text-sm">Allow friend requests</span>
            <Switch checked={me.allowFriendRequests} onCheckedChange={(checked) => void update({ allowFriendRequests: checked })} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
            <span className="text-sm">Share my online activity</span>
            <span className="block text-xs text-muted-foreground">Off hides presence and last-seen from everyone else.</span>
            <Switch checked={me.showPresence} onCheckedChange={(checked) => void update({ showPresence: checked })} />
          </label>
        </div>
      </Section>
    </>
  );
}

function SessionsTab() {
  const sessions = useQuery(api.users.listSessions);
  const revoke = useMutation(api.users.revokeSession);
  const revokeOthers = useMutation(api.users.revokeOtherSessions);

  return (
    <Section title="Active sessions" description="Sign out anywhere you no longer use Kyro.">
      <div className="grid gap-2">
        {sessions === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium">{session.current ? "This device" : "Another device"}</p>
                <p className="text-xs text-muted-foreground">Valid until {new Date(session.expirationTime).toLocaleDateString()}</p>
              </div>
              {!session.current && (
                <Button size="sm" variant="outline" onClick={() => void revoke({ sessionId: session.id as Id<"authSessions"> })}>
                  Revoke
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={() => void revokeOthers()}>
          Sign out all other sessions
        </Button>
      </div>
    </Section>
  );
}

function DataTab() {
  const exportData = useMutation(api.users.exportData);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const payload = await exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `kyro-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      sonnerToast.success("Your data export has downloaded.");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Export your data" description="Download everything Kyro stores about your account as JSON.">
        <Button variant="outline" onClick={download} disabled={busy}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          Download export
        </Button>
      </Section>

      <Section title="Delete account" description="Removes your profile, messages and memberships. Communities you own must be transferred or deleted first.">
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 size-4" /> Delete account
        </Button>
      </Section>

      <ConfirmDangerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your Kyro account"
        description="This permanently removes your messages, friendships and community memberships. It cannot be undone."
        confirmPhrase="DELETE"
        confirmLabel="Delete my account"
        onConfirm={async () => {
          await deleteAccount({ confirm: "DELETE" });
          window.location.assign("/");
        }}
      />
    </>
  );
}

/** Community settings (`/dashboard/s/:id/settings/`): every top-level tab hits
 *  the real backend. Everything below is rendered client-side.
 */
export function ServerSettings({ serverId }: { serverId: string }) {
  const server = useQuery(api.servers.get, { serverId: serverId as Id<"servers"> });
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [confirmName, setConfirmName] = useState("");
  const [removing, setRemoving] = useState(false);

  const update = useMutation(api.servers.update);
  const remove = useMutation(api.servers.remove);

  // Seed tab state when the server resolves.
  const [seededTab, setSeededTab] = useState<TabId | null>(null);
  const [seededKey, setSeededKey] = useState("");
  if (server && !seededTab) {
    setSeededTab("overview");
    setSeededKey(`${server.id}:${server.permissions?.includes(PERMISSIONS.MANAGE_SERVER) ? "1" : "0"}`);
  }

  if (server === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canManage = hasPermission(server.permissions, PERMISSIONS.MANAGE_SERVER);

  const destroy = async () => {
    setRemoving(true);
    try {
      await remove({ serverId: serverId as Id<"servers">, confirm: server.name });
      sonnerToast.success(`${server.name} was deleted.`);
      navigate("/dashboard");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Could not delete community.");
    } finally {
      setRemoving(false);
    }
  };

  const renderTab = (id: TabId) => {
    switch (id) {
      case "overview": return <OverviewTab server={server} />;
      case "roles": return <RolesTab server={server} />;
      case "moderation": return <ModerationTab server={server} />;
      case "settings": return <SettingsTab server={server} />;
      case "account": return <AccountTab />;
      case "profile": return <ProfileTab />;
      case "appearance": return <AppearanceTab />;
      case "privacy": return <PrivacyTab />;
      case "security": return <SessionsTab />;
      case "data": return <DataTab />;
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

        <h1 className="text-xl font-semibold">Server Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {server.memberCount} members · {server.isOwner ? "You own this community" : "You can manage this community"}
        </p>

        <div className="mt-4 flex flex-wrap gap-1">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                tab === entry.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface/70 hover:text-foreground",
              )}
            >
              <entry.icon className="size-4" />
              {entry.label}
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
            {TABS.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id} className="text-xs">
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={tab} className="mt-0">
            {renderTab(tab)}
          </TabsContent>
        </Tabs>
      </div>

      {server.isOwner && canManage && (
        <section className="rounded-lg border border-destructive/40 bg-panel p-5">
          <h2 className="text-sm font-semibold text-destructive">Delete community</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This permanently removes {server.name}, every channel and all messages inside it. It cannot be undone.
          </p>
          <div className="mt-3 space-y-2">
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type “${server.name}” to confirm`}
              aria-label="Confirm community name"
            />
            <Button
              variant="destructive"
              disabled={removing || confirmName.trim() !== server.name}
              onClick={() => void destroy()}
            >
              <Trash2 className="mr-2 size-4" />
              {removing ? <Loader2 className="size-4 animate-spin" /> : "Delete community"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
