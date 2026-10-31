import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Crown, Loader2, Users } from "@/components/icons";

/**
 * Pulls every invite code out of a message: any `/invite/<code>` URL, on the
 * canonical domain or another host, is enough to preview the community.
 */
export function extractInviteCodes(content: string): string[] {
  const found = new Set<string>();
  const pattern = /(?:https?:\/\/[^\s<>()]*)?\/invite\/([A-Za-z0-9_-]{2,64})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) found.add(match[1]);
  return Array.from(found);
}

function memberLabel(count: number): string {
  return `${count.toLocaleString()} member${count === 1 ? "" : "s"}`;
}

function createdLabel(at: number): string {
  return new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Rich preview of a community invite inside chat: logo, name, description,
 * owner, creation date and a one-click join. Expired or revoked invites fall
 * back to the plain link the sender pasted.
 */
export function ServerInviteCard({ code }: { code: string }) {
  const navigate = useNavigate();
  const preview = useQuery(api.servers.invitePreview, { code });
  const joinByCode = useMutation(api.servers.joinByCode);
  const [busy, setBusy] = useState(false);

  if (preview === undefined) {
    return (
      <div className="flex max-w-sm items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading invite…
      </div>
    );
  }
  if (!preview.valid) return null;

  const { server, alreadyMember } = preview;

  const open = async () => {
    if (busy) return;
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
    <div className="relative max-w-sm overflow-hidden rounded-xl border border-border/70 bg-surface shadow-sm transition-colors hover:border-brand/40">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-16 bg-gradient-to-br from-brand/25 via-cyan/10 to-transparent"
      />
      <div className="relative p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-cyan text-sm font-bold text-white ring-1 ring-white/15">
            {server.iconUrl ? (
              <img src={server.iconUrl} alt="" className="size-full object-cover" />
            ) : (
              server.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              You're invited to
            </p>
            <p className="truncate text-sm font-semibold leading-tight">{server.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="size-3 shrink-0" /> {memberLabel(server.memberCount)}
            </p>
          </div>
        </div>

        {server.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {server.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {server.owner && (
            <span className="flex items-center gap-1">
              <Crown className="size-3 shrink-0 text-warning" />
              {server.owner.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" /> Created {createdLabel(server.createdAt)}
          </span>
        </div>

        <Button
          size="sm"
          className="mt-2.5 h-7 w-full"
          disabled={busy}
          onClick={() => void open()}
        >
          {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {alreadyMember ? "Open community" : "Join community"}
          {!busy && <ArrowRight className="ml-1.5 size-3.5" />}
        </Button>
      </div>
    </div>
  );
}
