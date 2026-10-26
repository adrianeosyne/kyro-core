import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { RequireAuth } from "@/components/RequireAuth";
import { KyroMark } from "@/components/KyroMark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "@/components/icons";

/** Landing page for `/invite/:code` — previews the community and joins it. */
function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const preview = useQuery(
    api.servers.invitePreview,
    code ? { code } : "skip",
  );
  const joinByCode = useMutation(api.servers.joinByCode);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!code || busy) return;
    setBusy(true);
    try {
      const serverId = await joinByCode({ code });
      navigate(`/dashboard/s/${serverId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not join with that invite.",
      );
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-bold">
        <KyroMark className="size-8" /> Kyro
      </Link>

      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">You've been invited</CardTitle>
          <CardDescription>
            {preview === undefined
              ? "Checking that invite…"
              : preview.valid
                ? "Join this community on Kyro — it's free."
                : "This invite can't be used."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {preview === undefined ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading invite…
            </div>
          ) : preview.valid ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface p-4">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-cyan text-sm font-bold text-white">
                {preview.server.iconUrl ? (
                  <img
                    src={preview.server.iconUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  preview.server.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{preview.server.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {preview.server.memberCount} member
                  {preview.server.memberCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{preview.reason}</p>
          )}

          {preview?.valid && preview.server.description && (
            <p className="mt-3 text-sm text-muted-foreground">
              {preview.server.description}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Kyro
          </Button>
          {preview?.valid && (
            <Button
              className="ml-auto"
              disabled={busy}
              onClick={() => void join()}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {preview.alreadyMember ? "Open community" : "Accept invite"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

export default function InviteRoute() {
  return (
    <RequireAuth
      title="Sign in to accept this invite"
      description="Invites are tied to your Kyro account. Sign in (or make a free one) to join."
    >
      <InvitePage />
    </RequireAuth>
  );
}
