import { useQuery } from "convex/react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Input } from "@/components/ui/input";
import type { PresenceState } from "@/lib/format";
import { cn } from "@/lib/utils";

type Member = {
  user: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    presence: PresenceState;
    customStatus: string | null;
  };
  nickname: string | null;
  isOwner: boolean;
  topRoleColor: string | null;
  topRoleName: string;
};

/** Right-hand roster for a community. Clicking someone opens their profile. */
export function MemberList({ serverId }: { serverId: string }) {
  const data = useQuery(api.servers.members, {
    serverId: serverId as Id<"servers">,
  });
  const [term, setTerm] = useState("");
  const [, setParams] = useSearchParams();

  const openProfile = (userId: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("user", userId);
      return next;
    });
  };

  const matches = (member: Member) => {
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return (
      member.user.name.toLowerCase().includes(needle) ||
      (member.user.username ?? "").toLowerCase().includes(needle) ||
      (member.nickname ?? "").toLowerCase().includes(needle)
    );
  };

  if (data === undefined) {
    return (
      <aside className="hidden w-60 shrink-0 border-l border-border/60 bg-panel p-4 text-sm text-muted-foreground lg:block">
        Loading members…
      </aside>
    );
  }

  const online = data.online.filter(matches);
  const offline = data.offline.filter(matches);

  const row = (member: Member) => (
    <button
      key={member.user.id}
      type="button"
      onClick={() => openProfile(member.user.id)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
    >
      <UserAvatar user={member.user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className="truncate text-sm"
            style={
              member.topRoleColor ? { color: member.topRoleColor } : undefined
            }
          >
            {member.nickname ?? member.user.name}
          </span>
          {member.isOwner && (
            <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">
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
          aria-label="Search members"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          online · {online.length}
        </p>
        {online.map(row)}
        {offline.length > 0 && (
          <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            offline · {offline.length}
          </p>
        )}
        {offline.map(row)}
        {online.length === 0 && offline.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No members matched.
          </p>
        )}
      </div>
      <p
        className={cn(
          "border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground",
        )}
      >
        {data.online.length + data.offline.length} member
        {data.online.length + data.offline.length === 1 ? "" : "s"}
      </p>
    </aside>
  );
}
