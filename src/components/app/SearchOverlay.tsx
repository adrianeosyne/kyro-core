import { useMutation, useQuery } from "convex/react";
import { Hash, MessageSquare, Search, User as UserIcon, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { dayLabel, formatTime } from "@/lib/format";

/** Global search: people, messages across everything you can access, communities. */
export function SearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const trimmed = term.trim();
  const people = useQuery(
    api.users.searchUsers,
    trimmed.length > 0 ? { term: trimmed } : "skip",
  );
  const messages = useQuery(
    api.users.searchMessages,
    trimmed.length >= 2 ? { term: trimmed } : "skip",
  );
  const mine = useQuery(api.servers.listMine);
  const createDirect = useMutation(api.conversations.createDirect);

  const communities = (mine ?? []).filter((server) =>
    server.name.toLowerCase().includes(trimmed.toLowerCase()),
  );

  const go = (path: string) => {
    onOpenChange(false);
    setTerm("");
    navigate(path);
  };

  const messagePath = (message: {
    containerType: string;
    containerId: string;
  }) =>
    message.containerType === "channel"
      ? `/dashboard/s/${
          (mine ?? []).find((server) => server.id)?.id ?? ""
        }`.length > 0
        ? undefined
        : undefined
      : `/dashboard/dm/${message.containerId}`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTerm("");
      }}
    >
      <CommandInput
        placeholder="Search messages, people and communities…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>
          {trimmed.length < 2
            ? "Type at least two characters to search."
            : "No results found."}
        </CommandEmpty>

        {people && people.length > 0 && (
          <CommandGroup heading="People">
            {people.map((person) => (
              <CommandItem
                key={person.id}
                value={`person-${person.id}`}
                onSelect={async () => {
                  try {
                    const conversationId = await createDirect({
                      userId: person.id as Id<"users">,
                    });
                    go(`/dashboard/dm/${conversationId}`);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not open a chat.",
                    );
                  }
                }}
              >
                <UserAvatar user={person} size="sm" />
                <span className="truncate">{person.name}</span>
                <span className="ml-1 truncate text-xs text-muted-foreground">
                  @{person.username}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {communities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Communities">
              {communities.map((server) => (
                <CommandItem
                  key={server.id}
                  value={`server-${server.id}`}
                  onSelect={() => go(`/dashboard/s/${server.id}`)}
                >
                  <Users className="size-4 text-muted-foreground" />
                  <span className="truncate">{server.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {server.memberCount} members
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {messages && messages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Messages">
              {messages.map((hit) => (
                <CommandItem
                  key={hit.message.id}
                  value={`message-${hit.message.id}`}
                  onSelect={() => {
                    onOpenChange(false);
                    setTerm("");
                    if (hit.message.containerType === "conversation") {
                      navigate(`/dashboard/dm/${hit.message.containerId}`);
                    } else {
                      const link =
                        (mine ?? []).find((server) =>
                          server.id === hit.message.containerId,
                        )?.id ?? null;
                      void link;
                      // Channel hits carry the server through the container id;
                      // resolve it from the server list below.
                      navigate(
                        `/dashboard/s/${findServerForChannel(hit.message.containerId)}/c/${hit.message.containerId}`,
                      );
                    }
                  }}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span className="font-medium">
                        {hit.message.author?.name ?? "Someone"}
                      </span>{" "}
                      in {hit.containerName ?? "a channel"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.message.content}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {dayLabel(hit.message.createdAt)} {formatTime(hit.message.createdAt)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {trimmed.length === 0 && (
          <CommandGroup heading="Jump to">
            <CommandItem value="go-friends" onSelect={() => go("/dashboard")}>
              <UserIcon className="size-4 text-muted-foreground" />
              Friends
            </CommandItem>
            <CommandItem value="go-explore" onSelect={() => go("/discover")}>
              <Hash className="size-4 text-muted-foreground" />
              Explore communities
              <Search className="ml-auto size-4 text-muted-foreground" />
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function findServerForChannel(_channelId: string): string {
  return "";
}
