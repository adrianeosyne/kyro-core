import { useMutation, useQuery } from "convex/react";
import { Circle, Crown, LogOut, Settings, Sparkles } from "@/components/icons";
import { api } from "@/convex/_generated/api";
import { UserAvatar, UserBanner } from "@/components/app/UserAvatar";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StatusChoice } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

const STATUS_OPTIONS: { value: StatusChoice; label: string; dot: string }[] = [
  { value: "online", label: "Online", dot: "bg-success" },
  { value: "idle", label: "Idle", dot: "bg-warning" },
  { value: "dnd", label: "Do not disturb", dot: "bg-destructive" },
  { value: "invisible", label: "Invisible", dot: "bg-muted-foreground" },
];

/** Bottom-of-sidebar panel: who you are, your presence and settings.
 *  Kyro v1 has no voice transport, so there are deliberately no decorative
 *  mic/deafen buttons here.
 */
export function UserBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const me = useQuery(api.users.me);
  const [isOwner, setIsOwner] = useState(false);
  const setPresence = useMutation(api.users.setPresence);
  const { signOut } = useAuth();

  if (!me) return null;

  // Resolve "is server owner" from any membership row we can see.
  const checkOwnership = async (): Promise<boolean> => {
    const access = await api.servers.get({ serverId: "" } as any).catch(() => null);
    // Fall back to a lightweight member query against the first known server.
    const servers = await api.servers.listMine({} as any).catch(() => []);
    for (const server of servers) {
      if (server.ownerId === me.id) return true;
    }
    return false;
  };

  // Pre-fill before the dropdown opens so the badge appears instantly.
  useState(() => {
    // cannot do async in init; rely on the query below
    return null;
  });

  return (
    <div className="border-t border-border/60 bg-sidebar p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-sidebar-accent/70"
            onMouseEnter={() => checkOwnership().then(setIsOwner)}
          >
            <UserAvatar user={me} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">
                {me.name}
              </span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                @{me.username ?? "new"}
              </span>
            </span>
            <Settings className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Set status
          </DropdownMenuLabel>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() =>
                void setPresence({ status: option.value }).catch((error) =>
                  console.error(error),
                )
              }
            >
              <Circle className={cn("size-3 fill-current", option.dot)} />
              {option.label}
              {me.presence === option.value && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="size-4" /> User settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
