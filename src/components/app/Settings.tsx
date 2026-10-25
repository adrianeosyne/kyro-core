import { useMutation, useQuery } from "convex/react";
import {
  Download,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { ConfirmDangerDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  applyPreferences,
  useUiStore,
  type AccentChoice,
  type Density,
  type ThemeChoice,
} from "@/lib/store";
import { ACCEPTED_UPLOAD, MAX_UPLOAD_BYTES, useUploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabId =
  | "account"
  | "profile"
  | "appearance"
  | "privacy"
  | "security"
  | "data";

const TABS: { id: TabId; label: string; icon: typeof UserIcon }[] = [
  { id: "account", label: "My account", icon: UserIcon },
  { id: "profile", label: "Profile", icon: Palette },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "privacy", label: "Privacy & safety", icon: ShieldCheck },
  { id: "security", label: "Sessions", icon: ShieldCheck },
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

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab = "account",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState<TabId>(
    (TABS.find((entry) => entry.id === initialTab)?.id as TabId) ?? "account",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="shrink-0 gap-1 border-b border-border/60 p-3 sm:w-56 sm:border-b-0 sm:border-r">
            <DialogHeader className="mb-3 px-2 text-left">
              <DialogTitle className="text-base">Settings</DialogTitle>
              <DialogDescription className="sr-only">
                Account, appearance and privacy preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-1 overflow-x-auto sm:flex-col">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    tab === entry.id
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <entry.icon className="size-4" />
                  {entry.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === "account" && <AccountTab />}
            {tab === "profile" && <ProfileTab />}
            {tab === "appearance" && <AppearanceTab />}
            {tab === "privacy" && <PrivacyTab />}
            {tab === "security" && <SessionsTab />}
            {tab === "data" && <DataTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
      {description ? (
        <p className="mb-3 mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className={cn(!description && "mt-3")}>{children}</div>
    </section>
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
            <p className="truncate text-xs text-muted-foreground">
              {me.email ?? "No email on file"}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Username"
        description="Usernames can be changed once every 30 days."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-2">
            <Label htmlFor="settings-username">Username</Label>
            <Input
              id="settings-username"
              value={value}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              maxLength={32}
              className="w-64"
            />
          </div>
          <Button
            disabled={busy || value.length < 3 || value === me.username}
            onClick={async () => {
              setBusy(true);
              try {
                await claim({ username: value, name: me.name });
                toast.success("Username updated");
                setUsername(null);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not update username.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
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
      });
      toast.success("Profile saved");
      setName(null);
      setBio(null);
      setStatus(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your profile.",
      );
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
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserIcon className="size-4" />
              )}
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_UPLOAD_BYTES) {
                    toast.error("Images must be under 10 MB.");
                    return;
                  }
                  setUploading(true);
                  try {
                    const attachment = await upload(file);
                    await update({ avatarStorageId: attachment.storageId });
                    toast.success("Avatar updated");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Upload failed.",
                    );
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {me.avatarUrl && (
              <Button
                variant="outline"
                onClick={() => void update({ avatarStorageId: null })}
              >
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
            <Input
              id="profile-name"
              value={name ?? me.name}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-status">Custom status</Label>
            <Input
              id="profile-status"
              value={status ?? me.customStatus ?? ""}
              onChange={(event) => setStatus(event.target.value)}
              placeholder="Grinding ranked"
              maxLength={100}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio">About me</Label>
            <Textarea
              id="profile-bio"
              rows={3}
              value={bio ?? me.bio ?? ""}
              onChange={(event) => setBio(event.target.value)}
              maxLength={400}
            />
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
      <Section
        title="Theme"
        description="Kyro is dark by default, with a full light mode and system matching."
      >
        <div className="flex flex-wrap gap-2">
          {themes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPreference("theme", entry.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                theme === entry.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/70 bg-surface text-muted-foreground hover:text-foreground",
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
                accent === entry.id
                  ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "hover:scale-105",
              )}
              style={{ background: entry.color }}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Interface density"
        description="Tighter rows fit more of a conversation on screen."
      >
        <div className="flex gap-2">
          {(["comfortable", "compact"] as Density[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setPreference("density", entry)}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors",
                density === entry
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-surface text-muted-foreground",
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
          <Switch
            checked={showMemberList}
            onCheckedChange={(checked) => setPreference("showMemberList", checked)}
          />
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
      <Section
        title="Direct messages"
        description="Enforced on the server, not just in the interface."
      >
        <div className="flex flex-wrap gap-2">
          {(["everyone", "friends", "nobody"] as const).map((policy) => (
            <button
              key={policy}
              type="button"
              onClick={() => void update({ dmPolicy: policy })}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors",
                me.dmPolicy === policy
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-surface text-muted-foreground",
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
            <Switch
              checked={me.allowFriendRequests}
              onCheckedChange={(checked) =>
                void update({ allowFriendRequests: checked })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
            <span className="text-sm">
              Share my online activity
              <span className="block text-xs text-muted-foreground">
                Off hides presence and last-seen from everyone else.
              </span>
            </span>
            <Switch
              checked={me.showPresence}
              onCheckedChange={(checked) => void update({ showPresence: checked })}
            />
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
    <Section
      title="Active sessions"
      description="Sign out anywhere you no longer use Kyro."
    >
      <div className="grid gap-2">
        {sessions === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {session.current ? "This device" : "Another device"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Valid until {new Date(session.expirationTime).toLocaleDateString()}
                </p>
              </div>
              {!session.current && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void revoke({ sessionId: session.id as Id<"authSessions"> })
                  }
                >
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
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `kyro-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="Export your data"
        description="Download everything Kyro stores about your account as JSON."
      >
        <Button variant="outline" onClick={download} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Download export
        </Button>
      </Section>

      <Section
        title="Delete account"
        description="Removes your profile, messages and memberships. Communities you own must be transferred or deleted first."
      >
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 size-4" />
          Delete account
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

export { applyPreferences };
