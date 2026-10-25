import { useMutation, useQuery } from "convex/react";
import {
  Hash,
  Loader2,
  LogOut,
  MessagesSquare,
  MicOff,
  Plus,
  Search,
  Settings,
  UserPlus,
  Users,
} from "@/components/icons";
import { useMemo, useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { UserBar } from "@/components/app/UserBar";
import { CreateChannelDialog, InviteDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function Sidebar({
  activeServerId,
  onOpenSettings,
}: {
  activeServerId?: string;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeServerId ? (
          <ServerSection serverId={activeServerId} />
        ) : (
          <HomeSection />
        )}
      </div>
      <UserBar onOpenSettings={onOpenSettings} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Community sidebar                                                   */
/* ------------------------------------------------------------------ */

function ServerSection({ serverId }: { serverId: string }) {
  const serverQuery = useQuery(api.servers.get, {
    serverId: serverId as Id<"servers">,
  });
  const listing = useQuery(api.channels.list, {
    serverId: serverId as Id<"servers">,
  });
  const createCategory = useMutation(api.channels.createCategory);
  const leave = useMutation(api.servers.leave);
  const setMuted = useMutation(api.servers.setMuted);
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const activeChannel = useMatch("/dashboard/s/:serverId/c/:channelId");

  const permissions = listing?.permissions ?? [];
  const canManageChannels = permissions.includes(PERMISSIONS.MANAGE_CHANNELS);
  const canInvite = permissions.includes(PERMISSIONS.CREATE_INVITES);
  const canManageServer = permissions.includes(PERMISSIONS.MANAGE_SERVER);

  const groups = useMemo(() => {
    if (!listing) return [];
    type ChannelRow = (typeof listing.channels)[number];
    const loose: ChannelRow[] = [];
    const byCategory = new Map<string, ChannelRow[]>();
    for (const category of listing.categories) byCategory.set(category.id, []);
    for (const channel of listing.channels) {
      if (channel.categoryId) {
        byCategory.get(channel.categoryId)?.push(channel);
      } else {
        loose.push(channel);
      }
    }
    const result = [
      ...listing.categories.map((category) => ({
        id: category.id,
        name: category.name,
        channels: byCategory.get(category.id) ?? [],
      })),
      { id: "", name: "", channels: loose },
    ];
    return result.filter((group) => group.channels.length > 0);
  }, [listing]);

  if (!serverQuery || !listing) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  const server = serverQuery;

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border/60 bg-sidebar/95 backdrop-blur">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-sidebar-accent/60">
              <span className="truncate">{server.name}</span>
              <span className="text-xs text-muted-foreground">▾</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
              {server.memberCount} members
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canInvite && (
              <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" /> Invite people
              </DropdownMenuItem>
            )}
            {canManageChannels && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await createCategory({
                      serverId: serverId as Id<"servers">,
                      name: "New category",
                    });
                    toast.success("Category added");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed");
                  }
                }}
              >
                <Plus className="size-4" /> Add category
              </DropdownMenuItem>
            )}
            {canManageServer && (
              <DropdownMenuItem
                onClick={() => navigate(`/dashboard/s/${serverId}/settings/overview`)}
              >
                <Settings className="size-4" /> Community settings
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await setMuted({
                    serverId: serverId as Id<"servers">,
                    muted: !server.muted,
                  });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed");
                }
              }}
            >
              <MicOff className="size-4" />
              {server.muted ? "Unmute notifications" : "Mute notifications"}
            </DropdownMenuItem>
            {!server.isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    try {
                      await leave({ serverId: serverId as Id<"servers"> });
                      navigate("/dashboard");
                      toast.success(`Left ${server.name}`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed");
                    }
                  }}
                >
                  <LogOut className="size-4" /> Leave community
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-2 py-3">
        {groups.map((group) => (
          <div key={group.id || "loose"} className="mb-4 last:mb-0">
            {group.id !== "" && (
              <div className="group mb-1 flex items-center justify-between px-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((state) => ({
                      ...state,
                      [group.id]: !state[group.id],
                    }))
                  }
                  className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <span
                    className={cn(
                      "transition-transform",
                      collapsed[group.id] && "-rotate-90",
                    )}
                  >
                    ▾
                  </span>
                  <span className="truncate">{group.name}</span>
                </button>
                {canManageChannels && (
                  <button
                    type="button"
                    aria-label={`Add a channel to ${group.name}`}
                    onClick={() => setCreateOpen(true)}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Plus className="size-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            )}

            {!collapsed[group.id] &&
              group.channels.map((channel) => {
                const active = activeChannel?.params.channelId === channel.id;
                return (
                  <Link
                    key={channel.id}
                    to={`/dashboard/s/${serverId}/c/${channel.id}`}
                    title={channel.topic ?? channel.name}
                    className={cn(
                      "mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <Hash className="size-4 shrink-0 opacity-70" />
                    <span
                      className={cn(
                        "truncate",
                        channel.unread && !active && "font-semibold text-foreground",
                        channel.readOnly && "italic",
                      )}
                    >
                      {channel.name}
                    </span>
                    {channel.unread && !active && (
                      <span className="ml-auto size-1.5 shrink-0 rounded-full bg-foreground" />
                    )}
                  </Link>
                );
              })}
          </div>
        ))}

        {canManageChannels && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full justify-start gap-1.5 border-dashed"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" /> Create channel
          </Button>
        )}
      </div>

      <InviteDialog
        serverId={serverId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
      <CreateChannelDialog
        serverId={serverId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={listing.categories}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Home sidebar: friends + direct messages                             */
/* ------------------------------------------------------------------ */

function HomeSection() {
  const conversations = useQuery(api.conversations.list);
  const social = useQuery(api.social.list);
  const [query, setQuery] = useState("");
  const friendsMatch = useMatch("/dashboard");

  const pending = (social?.incoming.length ?? 0) + (social?.outgoing.length ?? 0);
  const filtered = (conversations ?? []).filter((conversation) => {
    if (!query.trim()) return true;
    const label = (
      conversation.name ??
      conversation.participants.map((user) => user.name).join(", ")
    ).toLowerCase();
    return label.includes(query.toLowerCase());
  });

  return (
    <div className="px-2 py-3">
      <Link
        to="/dashboard"
        className={cn(
          "mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm",
          friendsMatch
            ? "bg-sidebar-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        )}
      >
        <Users className="size-4" />
        Friends
        {pending > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-white">
            {pending}
          </span>
        )}
      </Link>

      <div className="mt-5 mb-1 flex items-center justify-between px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Direct messages
        </span>
        <NewConversationButton />
      </div>

      <div className="px-1 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {conversations === undefined ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">
          No conversations yet. Add a friend and start chatting.
        </p>
      ) : (
        filtered.map((conversation) => {
          const other = conversation.participants[0];
          const label =
            conversation.name ??
            conversation.participants.map((user) => user.name).join(", ");
          return (
            <Link
              key={conversation.id}
              to={`/dashboard/dm/${conversation.id}`}
              className="mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              <UserAvatar
                user={{
                  id: conversation.id,
                  name: label,
                  avatarUrl: conversation.type === "dm" ? (other?.avatarUrl ?? null) : null,
                  presence: conversation.type === "dm" ? other?.presence : "offline",
                }}
                size="sm"
                showStatus={conversation.type === "dm"}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {conversation.unread && (
                <span className="size-2 shrink-0 rounded-full bg-foreground" />
              )}
            </Link>
          );
        })
      )}
    </div>
  );
}

function NewConversationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="New direct message"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
      <NewConversationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Pick one friend for a DM, or several to start a group message. */
function NewConversationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const social = useQuery(api.social.list);
  const createDirect = useMutation(api.conversations.createDirect);
  const createGroup = useMutation(api.conversations.createGroup);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const friends = (social?.friends ?? []).filter(
    (friend) =>
      friend.name.toLowerCase().includes(term.toLowerCase()) ||
      (friend.username ?? "").toLowerCase().includes(term.toLowerCase()),
  );

  const start = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const conversationId =
        selected.length === 1
          ? await createDirect({ userId: selected[0] as Id<"users"> })
          : await createGroup({ userIds: selected as Id<"users">[] });
      onOpenChange(false);
      setSelected([]);
      setTerm("");
      navigate(`/dashboard/dm/${conversationId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the chat.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuContent align="start" className="w-72 p-2">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New message
        </p>
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search friends"
          className="mb-2 h-8"
        />
        <div className="max-h-64 overflow-y-auto">
          {friends.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Add friends first from the Friends page.
            </p>
          ) : (
            friends.map((friend) => {
              const isSelected = selected.includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() =>
                    setSelected((state) =>
                      state.includes(friend.id)
                        ? state.filter((id) => id !== friend.id)
                        : [...state, friend.id],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent",
                    isSelected && "bg-sidebar-accent",
                  )}
                >
                  <UserAvatar user={friend} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    {friend.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      @{friend.username}
                    </span>
                  </span>
                  {isSelected && <span className="text-xs text-primary">✓</span>}
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <Button size="sm" className="mt-2 w-full" onClick={start} disabled={busy}>
            <MessagesSquare className="mr-2 size-4" />
            {selected.length === 1 ? "Message" : `Message ${selected.length} people`}
          </Button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
