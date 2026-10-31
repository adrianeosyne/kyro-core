import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
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
import { useNow } from "@/hooks/use-now";
import { PresenceDot, UserAvatar } from "@/components/app/UserAvatar";
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
  type Density,
  type ThemeChoice,
} from "@/lib/store";
import {
  BUG_CATEGORY_IDS,
  BUG_CATEGORY_LABELS,
} from "@/lib/format";
import { AVATAR_FRAMES } from "@/lib/frames";
import { PROFILE_THEMES } from "@/lib/profileThemes";
import { APP_TINTS } from "@/lib/tints";
import {
  GLOBAL_BADGE_META,
  GlobalBadgeIcon,
  GlobalBadges,
  InlineBadge,
} from "@/components/app/GlobalBadges";
import { Slider } from "@/components/ui/slider";
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

/** The four states a person can pick; offline is never a manual choice. */
const PRESENCE_CHOICES = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Idle" },
  { value: "dnd", label: "Do not disturb" },
  { value: "invisible", label: "Invisible" },
] as const;

/** `alice@example.com` → `a***@example.com` until the user hits Reveal. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}


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
      <DialogContent className="flex h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 data-[state=open]:duration-200 sm:h-[88vh]">
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="shrink-0 gap-1.5 border-b border-border/60 bg-panel/40 p-4 sm:w-72 sm:border-b-0 sm:border-r">
            <DialogHeader className="mb-4 px-2 text-left">
              <DialogTitle className="text-lg">
                User settings
                <span className="ml-2 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                  Kyro
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Account, appearance and privacy preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150",
                    tab === entry.id
                      ? "bg-surface font-medium text-foreground shadow-sm ring-1 ring-border/70"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  )}
                >
                  <entry.icon className="size-4" />
                  {entry.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
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

/**
 * Password field with its own working reveal toggle. The button is a sibling
 * (not a child) of the input, so clicking it never submits the form and the
 * plain-text value is shown while keeping the field focusable.
 */
function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  label: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
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
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              value={current}
              onChange={setCurrent}
              label="current password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-new">New password</Label>
            <PasswordInput
              id="pw-new"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={setNext}
              label="new password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <PasswordInput
              id="pw-confirm"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={setConfirm}
              label="confirm new password"
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

/* Account standing — derived from real staff warnings (3-day expiry). */
const STANDING_LABELS = ["All good", "Limited", "Very limited", "Suspended"];
const STANDING_TITLES = [
  "Your account is all good",
  "Your account is limited",
  "Your account is more limited",
  "Your account is suspended",
];
const STANDING_BLURBS = [
  "Everything works normally.",
  "1 active warning — new communities and friend requests are off.",
  "2 active warnings — messaging is off too.",
  "3 active warnings — your account is suspended.",
];
const STANDING_COLORS = ["#16a34a", "#f59e0b", "#f59e0b", "#ef4444"];

function AccountStanding() {
  const standing = useQuery(api.warnings.mine);
  if (!standing) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const level = Math.min(standing.count, 3);
  return (
    <Section title="Account standing">
      <div className="rounded-xl border border-border/70 bg-surface p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `${STANDING_COLORS[level]}22`,
              color: STANDING_COLORS[level],
            }}
          >
            {level === 0 ? (
              <ShieldCheck className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{STANDING_TITLES[level]}</p>
            <p className="text-sm text-muted-foreground">
              {STANDING_BLURBS[level]}
            </p>
          </div>
        </div>

        {/* Four-step scale with the current step lit up. */}
        <div className="relative mt-6">
          <div className="absolute inset-x-[12%] top-1.5 h-px bg-border" />
          <div className="relative flex">
            {STANDING_LABELS.map((label, index) => (
              <div key={label} className="flex w-1/4 flex-col items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={
                    index === level
                      ? {
                          background: STANDING_COLORS[index],
                          boxShadow: `0 0 0 4px ${STANDING_COLORS[index]}33`,
                        }
                      : { background: "var(--border)" }
                  }
                />
                <span
                  className={
                    index === level
                      ? "text-center text-xs font-semibold text-foreground"
                      : "text-center text-xs text-muted-foreground"
                  }
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ul className="mt-4 list-disc space-y-1 rounded-md border border-border/60 bg-panel px-4 py-2.5 text-xs text-muted-foreground [&>li]:ml-4">
          <li>Warnings from Kyro's staff count for 3 days.</li>
          <li>
            1 warning limits your account: no new communities, no friend
            requests. 2 limit it more: no messages either. 3 suspend it.
          </li>
        </ul>

        {standing.warnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {standing.warnings.map((warning) => (
              <div
                key={warning.id}
                className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-warning">Active warning</p>
                <p className="mt-0.5 text-muted-foreground">{warning.reason}</p>
                <p className="mt-1 text-muted-foreground/70">
                  Expires{" "}
                  {new Date(warning.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

type BugStatus = "open" | "acknowledged" | "fixed" | "not_a_bug";

const BUG_STATUS_META: Record<BugStatus, { label: string; chip: string }> = {
  open: {
    label: "Open",
    chip: "border-warning/40 bg-warning/10 text-warning",
  },
  acknowledged: {
    label: "Acknowledged",
    chip: "border-brand/40 bg-brand/10 text-brand",
  },
  fixed: {
    label: "Fixed",
    chip: "border-success/40 bg-success/10 text-success",
  },
  not_a_bug: {
    label: "Not a bug",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

function BugRow({
  report,
  isAdmin,
}: {
  report: {
    id: string;
    title: string;
    details?: string | null;
    category?: string;
    status: BugStatus;
    staffNote: string | null;
    createdAt: number;
  };
  isAdmin: boolean;
}) {
  const update = useMutation(api.bugReports.updateStatus);
  const [note, setNote] = useState(report.staffNote ?? "");
  const [busy, setBusy] = useState(false);
  const meta = BUG_STATUS_META[report.status];

  const save = async (status: BugStatus) => {
    setBusy(true);
    try {
      await update({
        reportId: report.id as Id<"bugReports">,
        status,
        staffNote: note,
      });
      toast.success("Bug report updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update that.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-panel px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}
        >
          {meta.label}
        </span>
        <span className="shrink-0 rounded border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {BUG_CATEGORY_LABELS[report.category ?? "other"] ?? "Other"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {report.title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(report.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      {report.staffNote && (
        <p className="mt-1 text-xs text-muted-foreground">
          Staff: {report.staffNote}
        </p>
      )}
      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={report.status}
            aria-label={`Status for ${report.title}`}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            onChange={(event) => void save(event.target.value as BugStatus)}
          >
            {(Object.keys(BUG_STATUS_META) as BugStatus[]).map((status) => (
              <option key={status} value={status}>
                {BUG_STATUS_META[status].label}
              </option>
            ))}
          </select>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Staff note…"
            maxLength={300}
            className="h-8 flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save(report.status)}
          >
            {busy && <Loader2 className="mr-1 size-3 animate-spin" />}
            Save note
          </Button>
        </div>
      )}
    </div>
  );
}

function BugHunting() {
  const me = useQuery(api.users.me);
  const mine = useQuery(api.bugReports.mine);
  const all = useQuery(api.bugReports.list);
  const submit = useMutation(api.bugReports.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [busy, setBusy] = useState(false);

  const isAdmin = me?.role === "admin";
  const rows = isAdmin ? all : mine;

  const send = async () => {
    setBusy(true);
    try {
      await submit({ title, details, category });
      toast.success("Bug report sent — thanks.");
      setOpen(false);
      setTitle("");
      setDetails("");
      setCategory("other");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send that.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Bug hunting">
      <p className="text-sm text-muted-foreground">
        Found something broken, or a way to do something you shouldn't be able
        to? Report it — real reports get read by Kyro staff.
      </p>
      <Button className="mt-3" onClick={() => setOpen(true)}>
        Report a bug
      </Button>

      <div className="mt-4 space-y-2">
        {rows === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bug reports yet — yours would show up here.
          </p>
        ) : (
          rows.map((report) => (
            <BugRow
              key={report.id}
              report={report}
              isAdmin={isAdmin === true}
            />
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a bug</DialogTitle>
            <DialogDescription>
              Tell us what broke and how to make it happen again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bug-title">Title</Label>
              <Input
                id="bug-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Emoji picker closes instantly"
                maxLength={120}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bug-details">What happened?</Label>
              <Textarea
                id="bug-details"
                rows={4}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Steps, what you expected, what you saw."
                maxLength={2000}
              />
            </div>
            <div className="grid gap-2">
              <Label>What kind of bug?</Label>
              <div className="flex flex-wrap gap-1.5">
                {BUG_CATEGORY_IDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      category === value
                        ? "border-brand/60 bg-brand/15 text-foreground"
                        : "border-border/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {BUG_CATEGORY_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy || title.trim().length < 3}
                onClick={() => void send()}
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function AccountTab({ onEditProfile }: { onEditProfile: () => void }) {
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimProfile);
  const update = useMutation(api.users.updateProfile);
  const now = useNow(30_000);
  const { signOut } = useAuth();
  const [editing, setEditing] = useState<null | "name" | "username">(null);
  const [nameDraft, setNameDraft] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const updatePrivacy = useMutation(api.users.updatePrivacy);
  const revokeOthers = useMutation(api.users.revokeOtherSessions);
  const setPresence = useMutation(api.users.setPresence);

  const logoutEverywhere = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await revokeOthers();
      await signOut();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not sign out everywhere.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const cooldownMs = me.usernameChangedAt
    ? now === 0
      ? // Ticker not read yet this mount: assume a fresh change is still
        // cooling down rather than flashing "available".
        USERNAME_CHANGE_COOLDOWN_MS
      : Math.max(0, USERNAME_CHANGE_COOLDOWN_MS - (now - me.usernameChangedAt))
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
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-sm">
          <div className="relative h-32 bg-gradient-to-r from-brand/60 via-brand/30 to-cyan/40">
            {me.bannerUrl && (
              <img
                src={me.bannerUrl}
                alt=""
                className="size-full object-cover"
              />
            )}
            <span
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]"
            />
          </div>
          <div className="px-5 pb-4">
            <div className="-mt-14 flex flex-wrap items-end gap-4">
              <div className="shrink-0 rounded-full bg-surface p-1.5 shadow-lg ring-1 ring-border/60">
                <UserAvatar user={me} size="2xl" />
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <p className="flex flex-wrap items-center gap-2 text-xl font-semibold leading-tight">
                  <span className="truncate">{me.name}</span>
                  <InlineBadge badges={me.badges} primaryBadge={me.primaryBadge} />
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <PresenceDot presence={me.presence} size="sm" ringClassName="" />
                  @{me.username ?? "no username"}
                  {me.customStatus ? ` · ${me.customStatus}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-2 shrink-0"
                onClick={onEditProfile}
              >
                <Palette className="mr-1.5 size-4" /> Edit profile
              </Button>
            </div>

            {me.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Badges
                </span>
                <GlobalBadges badges={me.badges} />
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </span>
              {PRESENCE_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() =>
                    void setPresence({ status: choice.value }).catch((error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not update your status.",
                      ),
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    me.presence === choice.value
                      ? "border-brand/50 bg-brand/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PresenceDot
                    presence={choice.value}
                    size="xs"
                    ringClassName=""
                  />
                  {choice.label}
                </button>
              ))}
            </div>
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

      <AccountStanding />

      <Section title="Privacy">
        <div className="grid gap-3">
          <div className="rounded-xl border border-border/70 bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Who can message you
            </p>
            <select
              value={me.dmPolicy}
              aria-label="Who can message you"
              className="mt-2 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                void updatePrivacy({
                  dmPolicy: event.target.value as
                    | "everyone"
                    | "friends"
                    | "nobody",
                })
              }
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends only</option>
              <option value="nobody">No one</option>
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Friends can always message you. Blocked people never can.
            </p>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface p-4">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                Suggest me to people with similar interests
              </span>
              <span className="block text-xs text-muted-foreground">
                Shows you under Friends → Suggested for people who share your
                communities. Hidden connections never count.
              </span>
            </span>
            <Switch
              checked={me.suggestible}
              onCheckedChange={(checked) =>
                void updatePrivacy({ suggestible: checked })
              }
            />
          </label>
        </div>
      </Section>

      <BugHunting />

      <Section title="Account">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-surface p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Log out of all devices</p>
            <p className="text-xs text-muted-foreground">
              Signs this account out everywhere, including here. Use it if you
              think someone else has your login.
            </p>
          </div>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void logoutEverywhere()}
          >
            Log out everywhere
          </Button>
        </div>
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
  const claim = useMutation(api.users.claimProfile);
  const myServers = useQuery(api.servers.listMine);
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [pronouns, setPronouns] = useState<string | null>(null);
  // undefined = untouched, null = cleared (None), string = chosen id/tag.
  const [wornTagSel, setWornTagSel] = useState<string | null | undefined>(
    undefined,
  );
  const [badgeSel, setBadgeSel] = useState<string | null | undefined>(undefined);
  const [themeSel, setThemeSel] = useState<string | null | undefined>(undefined);
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
      const nextUsername = (usernameDraft ?? me.username ?? "").trim();
      if (nextUsername && nextUsername !== me.username) {
        // Claiming a handle is its own mutation — it owns the 1-hour cooldown.
        await claim({ username: nextUsername, name: name ?? me.name });
      }
      await update({
        name: name ?? undefined,
        bio: bio ?? undefined,
        customStatus: status ?? undefined,
        pronouns: pronouns ?? undefined,
      });
      toast.success("Profile saved");
      setName(null);
      setBio(null);
      setStatus(null);
      setPronouns(null);
      setUsernameDraft(null);
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
          <UserAvatar user={me} size="xl" />
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

      <Section
        title="Community tag"
        description="Wear one of your communities' tags next to your name everywhere on Kyro."
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              if ((wornTagSel === undefined ? me.serverTag : wornTagSel) === null)
                return;
              setWornTagSel(null);
              void update({ wornTag: null }).catch((error) => {
                setWornTagSel(undefined);
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not remove the tag.",
                );
              });
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors",
              (wornTagSel === undefined ? me.serverTag : wornTagSel) === null
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/70 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex h-8 items-center justify-center rounded border border-dashed border-border px-3">
              —
            </span>
            None
          </button>
          {(myServers ?? [])
            .filter((entry) => entry.tag)
            .map((entry) => {
              const active =
                (wornTagSel === undefined ? me.serverTag : wornTagSel) ===
                entry.tag;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setWornTagSel(entry.tag);
                    void update({ wornTag: entry.tag }).catch((error) => {
                      setWornTagSel(undefined);
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not wear that tag.",
                      );
                    });
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex h-8 items-center rounded border border-border bg-panel px-2 text-xs font-bold uppercase tracking-wider">
                    {entry.tag}
                  </span>
                  <span className="w-full truncate text-center">
                    {entry.name}
                  </span>
                </button>
              );
            })}
          {(myServers ?? []).every((entry) => !entry.tag) && (
            <p className="col-span-full text-xs text-muted-foreground">
              None of your communities have a tag yet — owners can add one in
              Server settings → Overview.
            </p>
          )}
        </div>
      </Section>

      <Section
        title="Badge"
        description="This one shows next to your name in chat and the member list. Your profile card shows all of them. None hides them everywhere."
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {me.badges.map((badge) => {
            const active =
              (badgeSel === undefined
                ? (me.primaryBadge ?? me.badges[0] ?? "none")
                : badgeSel) === badge;
            return (
              <button
                key={badge}
                type="button"
                onClick={() => {
                  setBadgeSel(badge);
                  void update({ primaryBadge: badge }).catch((error) => {
                    setBadgeSel(undefined);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not save that badge.",
                    );
                  });
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                  active
                    ? "border-ring/60 bg-primary/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-border/70 bg-surface/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    ✓
                  </span>
                )}
                <GlobalBadgeIcon badge={badge} className="size-5" />
                {GLOBAL_BADGE_META[badge].label}
              </button>
            );
          })}
          {(() => {
            const active =
              (badgeSel === undefined
                ? (me.primaryBadge ?? me.badges[0] ?? "none")
                : badgeSel) === "none";
            return (
              <button
                type="button"
                onClick={() => {
                  setBadgeSel("none");
                  void update({ primaryBadge: "none" }).catch((error) => {
                    setBadgeSel(undefined);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not save that.",
                    );
                  });
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                  active
                    ? "border-ring/60 bg-primary/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-border/70 bg-surface/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    ✓
                  </span>
                )}
                <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-border">
                  <X className="size-3" />
                </span>
                None
              </button>
            );
          })()}
        </div>
      </Section>

      <Section
        title="Profile theme"
        description="Colours your profile card and its banner when you have no picture."
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              if ((themeSel === undefined ? me.profileTheme : themeSel) === null)
                return;
              setThemeSel(null);
              void update({ profileTheme: "" }).catch((error) => {
                setThemeSel(undefined);
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not remove the theme.",
                );
              });
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors",
              (themeSel === undefined ? me.profileTheme : themeSel) === null
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/70 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-border">
              <X className="size-4" />
            </span>
            None
          </button>
          {PROFILE_THEMES.map((theme) => {
            const active =
              (themeSel === undefined ? me.profileTheme : themeSel) === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  setThemeSel(theme.id);
                  void update({ profileTheme: theme.id }).catch((error) => {
                    setThemeSel(undefined);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not save that theme.",
                    );
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
                    "size-10 rounded-full bg-gradient-to-br",
                    theme.gradient,
                  )}
                />
                {theme.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Identity">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-username">Username</Label>
            <Input
              id="profile-username"
              value={usernameDraft ?? me.username ?? ""}
              onChange={(event) =>
                setUsernameDraft(event.target.value.toLowerCase())
              }
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              You can change your username once every hour.
            </p>
          </div>
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
            <Label htmlFor="profile-pronouns">Pronouns</Label>
            <Input
              id="profile-pronouns"
              value={pronouns ?? me.pronouns ?? ""}
              onChange={(event) => setPronouns(event.target.value)}
              placeholder="He/Him"
              maxLength={32}
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
            <p className="text-right text-xs text-muted-foreground">
              {400 - (bio ?? me.bio ?? "").length} left
            </p>
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
  const density = useUiStore((state) => state.density);
  const showMemberList = useUiStore((state) => state.showMemberList);
  const tint = useUiStore((state) => state.tint);
  const tintA = useUiStore((state) => state.tintA);
  const tintB = useUiStore((state) => state.tintB);
  const tintIntensity = useUiStore((state) => state.tintIntensity);
  const useServerColours = useUiStore((state) => state.useServerColours);
  const unreadDmBubbles = useUiStore((state) => state.unreadDmBubbles);
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

      <Section
        title="Colour themes"
        description="Tint the whole app. Free, obviously."
      >
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          <button
            type="button"
            aria-label="No colour tint"
            onClick={() => setPreference("tint", "none")}
            className={cn(
              "relative aspect-square rounded-xl border transition-colors",
              tint === "none"
                ? "border-foreground"
                : "border-border/70 hover:border-border",
            )}
          >
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              None
            </span>
            {tint === "none" && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                ✓
              </span>
            )}
          </button>
          {APP_TINTS.map((entry) => {
            const active = tint === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-label={`Colour theme ${entry.id}`}
                onClick={() => setPreference("tint", entry.id)}
                className={cn(
                  "relative aspect-square rounded-xl transition-transform",
                  active
                    ? "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "hover:scale-105",
                )}
                style={{
                  backgroundImage: `linear-gradient(135deg, ${entry.a}, ${entry.b})`,
                }}
              >
                {active && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-surface p-3">
          <span
            className="size-10 shrink-0 rounded-lg"
            style={{
              backgroundImage: `linear-gradient(135deg, ${tintA}, ${tintB})`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Custom theme</p>
            <p className="text-xs text-muted-foreground">
              Two colours. Then set how strong it is.
            </p>
          </div>
          <label
            className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
            style={{ background: tintA }}
            title="First colour"
          >
            <input
              type="color"
              value={tintA}
              aria-label="Custom theme first colour"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              onChange={(event) => {
                setPreference("tintA", event.target.value);
                setPreference("tint", "custom");
              }}
            />
          </label>
          <label
            className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
            style={{ background: tintB }}
            title="Second colour"
          >
            <input
              type="color"
              value={tintB}
              aria-label="Custom theme second colour"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              onChange={(event) => {
                setPreference("tintB", event.target.value);
                setPreference("tint", "custom");
              }}
            />
          </label>
          <Button
            size="sm"
            variant={tint === "custom" ? "default" : "outline"}
            onClick={() => setPreference("tint", "custom")}
          >
            Use custom
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Intensity</span>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[tintIntensity]}
            onValueChange={(values) =>
              setPreference("tintIntensity", values[0] ?? 75)
            }
            className="flex-1"
            aria-label="Tint intensity"
          />
          <span className="w-10 text-right text-sm font-semibold">
            {tintIntensity}%
          </span>
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

      <Section title="Server colours">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
          <span className="text-sm">
            Use a server's own colours
            <span className="block text-xs text-muted-foreground">
              Show a community's colours while you're in it. Turn off to always
              keep yours.
            </span>
          </span>
          <Switch
            checked={useServerColours}
            onCheckedChange={(checked) =>
              setPreference("useServerColours", checked)
            }
          />
        </label>
      </Section>

      <Section title="Server list">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface px-4 py-3">
          <span className="text-sm">
            Unread DMs in the server list
            <span className="block text-xs text-muted-foreground">
              People who just messaged you show up as bubbles under Home. Turn
              off if they pile up.
            </span>
          </span>
          <Switch
            checked={unreadDmBubbles}
            onCheckedChange={(checked) =>
              setPreference("unreadDmBubbles", checked)
            }
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
