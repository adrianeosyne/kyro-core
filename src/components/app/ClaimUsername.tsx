import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, X } from "@/components/icons";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { KyroMark } from "@/components/KyroMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const HANDLE_PATTERN = /^[a-z0-9_]{3,32}$/;

/** First-run screen: pick the unique @handle every Kyro account needs. */
export function ClaimUsername() {
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimProfile);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the display-name field from the profile once it loads, without
  // clobbering what the user has typed (adjust-state-during-render pattern).
  const [seededName, setSeededName] = useState<string | null>(null);
  if (me?.name && !displayName && seededName !== me.name) {
    setSeededName(me.name);
    setDisplayName(me.name);
  }

  const normalized = username.trim().toLowerCase();
  const valid = HANDLE_PATTERN.test(normalized);
  const available = useQuery(
    api.users.usernameAvailable,
    valid ? { username: normalized } : "skip",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || available === false) return;
    setBusy(true);
    setError(null);
    try {
      await claim({ username: normalized, name: displayName || undefined });
      toast.success(`Welcome to Kyro, @${normalized}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-6">
      <div className="kyro-orb pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2" />
      <div className="kyro-grid pointer-events-none absolute inset-0" />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-panel p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <KyroMark className="mb-4 size-12" />
          <h1 className="text-xl font-semibold tracking-tight">Claim your username</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your @username is how friends find you and how mentions work. You can
            change it once every 30 days.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <div className="flex items-center rounded-md border border-input bg-background px-3">
            <span className="text-sm text-muted-foreground">@</span>
            <input
              id="username"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="nightowl"
              maxLength={32}
              className="h-9 flex-1 bg-transparent pl-1 text-sm outline-none"
            />
            {username.length >= 3 &&
              (available === undefined ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : available ? (
                <Check className="size-4 text-success" />
              ) : (
                <X className="size-4 text-destructive" />
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            3–32 characters: lowercase letters, numbers and underscores.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Night Owl"
            maxLength={64}
          />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={busy || !valid || available === false}
        >
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue to Kyro
        </Button>
      </form>
    </div>
  );
}
