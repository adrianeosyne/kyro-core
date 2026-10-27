import { useAction, useMutation, useQuery } from "convex/react";
import {
  Download,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from "@/components/icons";
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
import { AVATAR_FRAMES } from "@/lib/frames";
import { MAX_UPLOAD_BYTES, useUploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProfileLink = { label: string; url: string };

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

/** Mirrors USERNAME_COOLDOWN_MS in src/convex/users.ts — shown as a hint. */
const USERNAME_CHANGE_COOLDOWN_MS = 60 * 60 * 1000;

/** `alice@example.com` → `a***@example.com` until the user hits Reveal. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

const ACCENTS: { id: AccentChoice; label: string; color: string }[] = [
  { id: "default", label: "Blurple", color: "#5865F2" },
  { id: "cyan", label: "Cyan", color: "#0E9FD8" },
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "violet", label: "Violet", color: "#8B5CF6" },
  { id: "fuchsia", label: "Fuchsia", color: "#D946EF" },
  { id: "emerald", label: "Emerald", color: "#10B981" },
  { id: "teal", label: "Teal", color: "#14B8A6" },
  { id: "rose", label: "Rose", color: "#F43F5E" },
  { id: "orange", label: "Orange", color: "#F97316" },
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
            {tab === "account" && (
              <AccountTab onEditProfile={() => setTab("profile")} />
            )}
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

/** One labelled field row on the My Account card: value + Edit action. */
function AccountRow({
  label,
  hint,
  children,
  action,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 truncate text-sm">{children}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Modal for swapping this account's password after re-authentication. */
function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // `users/changePassword.ts` nests one level deeper in the generated API.
  const changePassword = useAction(api.users.changePassword.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (value: boolean) => {
    if (!value) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    onOpenChange(value);
  };

  const submit = async () => {
    if (next !== confirm) {
      toast.error("New passwords don't match.");
      return;
    }
    if (next.length < 8) {
      toast.error("New passwords need at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.success("Password changed — use it the next time you sign in.");
      close(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change your password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Confirm your current password, then choose a new one. You'll use it
            the next time you sign in.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !current || next.length < 8}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Change password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountTab({ onEditProfile }: { onEditProfile: () => void }) {
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimProfile);
  const update = useMutation(api.users.updateProfile);
  const { signOut } = useAuth();
  const [editing, setEditing] = useState<null | "name" | "username">(null);
  const [nameDraft, setNameDraft] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const cooldownMs = me.usernameChangedAt
    ? Math.max(
        0,
        USERNAME_CHANGE_COOLDOWN_MS - (Date.now() - me.usernameChangedAt),
      )
    : 0;
  const cooldownLabel = (() => {
    const minutes = Math.ceil(cooldownMs / 60_000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return `${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} min` : ""}`;
    }
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  })();

  const save = async (kind: "name" | "username") => {
    setBusy(true);
    try {
      if (kind === "name") {
        await update({ name: nameDraft });
        toast.success("Display name updated");
      } else {
        await claim({ username: userDraft, name: me.name });
        toast.success("Username updated");
      }
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save that.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Identity card: banner, avatar and the field rows beneath it. */}
      <section className="mb-7">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-surface">
          <div className="relative h-28 bg-gradient-to-r from-brand/60 via-brand/30 to-cyan/40">
            {me.bannerUrl && (
              <img
                src={me.bannerUrl}
                alt=""
                className="size-full object-cover"
              />
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-4 text-center text-2xl font-bold uppercase tracking-[0.3em] text-white/30 select-none"
            >
              {me.name}
            </span>
          </div>
          <div className="flex items-end gap-4 px-4 pb-4">
            <div className="-mt-8 shrink-0 rounded-full border-4 border-surface bg-panel">
              <UserAvatar user={me} size="xl" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-lg font-semibold leading-tight">
                {me.name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{me.username ?? "no username"}
                {me.customStatus ? ` · ${me.customStatus}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mb-1 shrink-0"
              onClick={onEditProfile}
            >
              Edit profile
            </Button>
          </div>
        </div>

        <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
          <AccountRow
            label="Display name"
            action={
              editing === "name" ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      busy ||
                      nameDraft.trim().length < 2 ||
                      nameDraft === me.name
                    }
                    onClick={() => void save("name")}
                  >
                    {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNameDraft(me.name);
                    setEditing("name");
                  }}
                >
                  Edit
                </Button>
              )
            }
          >
            {editing === "name" ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={64}
                className="h-9"
                aria-label="Display name"
              />
            ) : (
              <span className="truncate">{me.name}</span>
            )}
          </AccountRow>

          <AccountRow
            label="Username"
            hint={
              cooldownMs > 0
                ? `You can change your username again in ${cooldownLabel}.`
                : "You can change your username once every hour."
            }
            action={
              editing === "username" ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      busy ||
                      userDraft.length < 3 ||
                      userDraft === me.username
                    }
                    onClick={() => void save("username")}
                  >
                    {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cooldownMs > 0}
                  onClick={() => {
                    setUserDraft(me.username ?? "");
                    setEditing("username");
                  }}
                >
                  Edit
                </Button>
              )
            }
          >
            {editing === "username" ? (
              <Input
                autoFocus
                value={userDraft}
                onChange={(event) => setUserDraft(event.target.value.toLowerCase())}
                maxLength={32}
                className="h-9"
                aria-label="Username"
              />
            ) : (
              <span className="truncate">@{me.username ?? "—"}</span>
            )}
          </AccountRow>

          <AccountRow
            label="Email"
            action={
              me.email ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRevealed((value) => !value)}
                >
                  {revealed ? "Hide" : "Reveal"}
                </Button>
              ) : undefined
            }
          >
            {me.email ? (
              <span className="truncate">
                {revealed ? me.email : maskEmail(me.email)}
              </span>
            ) : (
              <span className="text-muted-foreground">No email on file</span>
            )}
          </AccountRow>
        </div>
      </section>

      <Section title="Password and authentication">
        <Button onClick={() => setPasswordOpen(true)}>
          Change password
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          You'll need your current password. Changing it doesn't sign you out
          here.
        </p>
      </Section>

      <Section title="Session">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </Section>

      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
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
  const [links, setLinks] = useState<ProfileLink[] | null>(null);
  // undefined = not touched yet, null = plain avatar (no frame).
  const [frameSel, setFrameSel] = useState<string | null | undefined>(undefined);
  const [linksBusy, setLinksBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

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

      <Section title="Banner">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-20 w-56 overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-brand to-cyan">
            {me.bannerUrl && (
              <img
                src={me.bannerUrl}
                alt="Your profile banner"
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-sm hover:bg-surface/70">
              {uploadingBanner ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Palette className="size-4" />
              )}
              Upload banner
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
                  setUploadingBanner(true);
                  try {
                    const attachment = await upload(file);
                    await update({ bannerStorageId: attachment.storageId });
                    toast.success("Banner updated");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Upload failed.",
                    );
                  } finally {
                    setUploadingBanner(false);
                  }
                }}
              />
            </label>
            {me.bannerUrl && (
              <Button
                variant="outline"
                onClick={() => void update({ bannerStorageId: null })}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Images and GIFs both work — animated banners play on your profile.
        </p>
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

      <Section
        title="Avatar frame"
        description="Give your profile a fresh look — a frame around your picture. Built-in ones are free."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <UserAvatar
              user={{ ...me, avatarFrame: frameSel === undefined ? me.avatarFrame : frameSel }}
              size="xl"
            />
            <span className="text-xs text-muted-foreground">
              {(() => {
                const id = frameSel === undefined ? me.avatarFrame : frameSel;
                return AVATAR_FRAMES.find((frame) => frame.id === id)?.label ?? "No frame";
              })()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                if ((frameSel === undefined ? me.avatarFrame : frameSel) === null) return;
                setFrameSel(null);
                void update({ avatarFrame: null }).catch((error) => {
                  setFrameSel(undefined);
                  toast.error(
                    error instanceof Error ? error.message : "Could not remove the frame.",
                  );
                });
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors",
                (frameSel === undefined ? me.avatarFrame : frameSel) === null
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                <X className="size-4" />
              </span>
              None
            </button>
            {AVATAR_FRAMES.map((frame) => {
              const active = (frameSel === undefined ? me.avatarFrame : frameSel) === frame.id;
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => {
                    setFrameSel(frame.id);
                    void update({ avatarFrame: frame.id }).catch((error) => {
                      setFrameSel(undefined);
                      toast.error(error instanceof Error ? error.message : "Could not save the frame.");
                    });
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-10 rounded-full bg-gradient-to-br p-[3px]",
                      frame.gradient,
                    )}
                  >
                    <span className="flex size-full items-center justify-center rounded-full bg-panel text-[10px] font-semibold">
                      {frame.label.slice(0, 2)}
                    </span>
                  </span>
                  {frame.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        title="Links"
        description="Shown on your profile — up to 6. Think YouTube, portfolio, a site you run."
      >
        <div className="space-y-2">
          {(links ?? me.links).map((link, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={link.label}
                placeholder="Label (e.g. YouTube)"
                maxLength={40}
                className="w-40 flex-none"
                onChange={(event) => {
                  const next = [...(links ?? me.links)];
                  next[index] = { ...next[index], label: event.target.value };
                  setLinks(next);
                }}
              />
              <Input
                value={link.url}
                placeholder="https://…"
                maxLength={200}
                className="flex-1"
                onChange={(event) => {
                  const next = [...(links ?? me.links)];
                  next[index] = { ...next[index], url: event.target.value };
                  setLinks(next);
                }}
              />
              <button
                type="button"
                aria-label={`Remove link ${link.label || index + 1}`}
                className="rounded-md border border-border/70 px-2 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setLinks((links ?? me.links).filter((_, i) => i !== index))
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {(links ?? me.links).length === 0 && (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(links ?? me.links).length >= 6}
              onClick={() =>
                setLinks([...(links ?? me.links), { label: "", url: "" }])
              }
            >
              <Plus className="mr-1.5 size-4" /> Add link
            </Button>
            <Button
              size="sm"
              disabled={linksBusy || links === null}
              onClick={async () => {
                const rows = (links ?? []).filter(
                  (link) => link.label.trim() && link.url.trim(),
                );
                for (const row of rows) {
                  if (!/^https?:\/\//i.test(row.url.trim())) {
                    row.url = `https://${row.url.trim()}`;
                  }
                }
                setLinksBusy(true);
                try {
                  await update({ links: rows });
                  toast.success("Links saved");
                  setLinks(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not save links.",
                  );
                } finally {
                  setLinksBusy(false);
                }
              }}
            >
              {linksBusy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save links
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
