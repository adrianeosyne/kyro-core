import { useMutation, useQuery } from "convex/react";
import { Circle, LogOut, Settings } from "@/components/icons";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/app/UserAvatar";
import { CrownBadge } from "@/components/app/CrownBadge";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { StatusChoice } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

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
  const servers = useQuery(api.servers.listMine);
  const updateProfile = useMutation(api.users.updateProfile);
  const setPresence = useMutation(api.users.setPresence);
  const { signOut } = useAuth();
  const [statusDraft, setStatusDraft] = useState("");

  if (!me) return null;

  const ownsServer = (servers ?? []).some((server) => server.isOwner);

  const saveStatus = async () => {
    try {
      await updateProfile({ customStatus: statusDraft });
      toast.success(
        statusDraft.trim() ? "Custom status set" : "Custom status cleared",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not set your status.",
      );
    }
  };

  return (
    <div className="border-t border-border/60 bg-sidebar p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-sidebar-accent/70">
            <UserAvatar user={me} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium leading-tight">
                  {me.name}
                </span>
                {me.isFounder ? (
                  <CrownBadge variant="founder" label="Kyro founder" />
                ) : ownsServer ? (
                  <CrownBadge label="Server owner" />
                ) : null}
              </span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {me.customStatus || `@${me.username ?? "new"}`}
              </span>
            </span>
            <Settings className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
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
          <div className="px-2 py-1.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveStatus();
              }}
              className="flex items-center gap-1.5"
            >
              <Input
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
                placeholder="Set a custom status"
                maxLength={100}
                className="h-7 text-xs"
                aria-label="Custom status"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                Save
              </button>
            </form>
          </div>
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
