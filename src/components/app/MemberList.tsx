import { useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Right-hand member list for a community, grouped by presence. */
export function MemberList({ serverId }: { serverId: string }) {
  const data = useQuery(api.servers.members, {
    serverId: serverId as Id<"servers">,
  });
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  if (!data) {
    return (
      <aside className="hidden w-60 shrink-0 border-l border-border/60 bg-panel p-4 text-sm text-muted-foreground lg:block">
        Loading members…
      </aside>
    );
  }

  const matches = (name: string, username?: string | null) =>
    !term ||
    name.toLowerCase().includes(term.toLowerCase()) ||
    (username ?? "").toLowerCase().includes(term.toLowerCase());

  const online = data.online.filter((member) =>
    matches(member.user.name, member.user.username),
  );
  const offline = data.offline.filter((member) =>
    matches(member.user.name, member.user.username),
  );

  const row = (member: (typeof online)[number]) => (
    <button
      key={member.user.id}
      type="button"
      onClick={() => navigate(`/dashboard?user=${member.user.id}`)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
    >
      <UserAvatar user={member.user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className="truncate text-sm"
            style={member.topRoleColor ? { color: member.topRoleColor } : undefined}
          >
            {member.nickname ?? member.user.name}
          </span>
          {member.isOwner && (
            <span
              className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning"
              title="Community owner"
            >
              OWNER
            </span>
          )}
        </span>
        {member.user.customStatus && (
          <span className="block truncate text-xs text-muted-foreground">
            {member.user.customStatus}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-border/60 bg-panel lg:flex">
      <div className="border-b border-border/60 p-3">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search members"
          className="h-8 text-xs"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <SectionLabel count={online.length}>Online</SectionLabel>
        <div className="mb-4">{online.map(row)}</div>
        {offline.length > 0 && (
          <>
            <SectionLabel count={offline.length}>Offline</SectionLabel>
            <div className="opacity-50">{offline.map(row)}</div>
          </>
        )}
        {online.length === 0 && offline.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">No members matched.</p>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children} · {count}
    </p>
  );
}

export function MemberListClassnames() {
  return cn("hidden", "lg:flex");
}
