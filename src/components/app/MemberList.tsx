import { useMutation } from "convex/react";
import { useSearchParams } from "react-router";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";

export function MemberList({ serverId }: { serverId: string }) {
  const data = useQuery(
    serverId ? { serverId: serverId as Id<"servers"> } : "skip",
    serverId as Id<"servers">,
  );
  const [term, setTerm] = useState("");
  const [params, setParams] = useSearchParams();
  const joinDM = useMutation(api.conversations.createDirect);

  const joinDMchannel = (member: { user: { id: string } }) => {
    try {
      const convId = joinDM.mutate({ userId: member.user.id } as never);
      window.location.assign(`/dashboard/dm/${convId}`);
      window.location.reload();
    } catch { toast.error("Could not open DM."); }
  };

  const row = (member: { user: { id: string; name: string; username: string | null; avatarUrl: string | null; customStatus: string | null } } & { nickname: string | null; topRoleColor: string | null; isOwner: boolean }) => (
    <button type="button" onClick={() => joinDMchannel(member)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface">
      <UserAvatar user={member.user} size="sm" showStatus={false} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm" style={member.topRoleColor ? { color: member.topRoleColor } : undefined}>{member.nickname ?? member.user.name}</span>
          {member.isOwner && <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">OWNER</span>}
        </span>
        {member.user.customStatus && <span className="block truncate text-xs text-muted-foreground">{member.user.customStatus}</span>}
      </span>
    </button>
  );

  if (!data || !data.online) {
    return (
      <aside className="hidden w-60 shrink-0 border-l border-border/60 bg-panel p-4 text-sm text-muted-foreground lg:block">
        Loading members…
      </aside>
    );
  }

  const online = data.online.filter((m) => (m.user.name ?? "").toLowerCase().includes(term.toLowerCase()));
  const offline = data.offline.filter((m) => (m.user.name ?? "").toLowerCase().includes(term.toLowerCase()));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-border/60 bg-panel lg:flex">
      <div className="border-b border-border/60 p-3"><Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search members" className="h-8 text-xs" /></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">online · {online.length}</p>
        {online.map(row)}
        {offline.length > 0 && <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">offline · {offline.length}</p>}
        {offline.map(row)}
        {online.length === 0 && offline.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">No members matched.</p>}
      </div>
    </aside>
  );
}
