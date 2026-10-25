import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CornerUpLeft,
  Loader2,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayKey, dayLabel, formatTime, type PresenceState } from "@/lib/format";
import { renderMessage } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MessageAuthor {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  presence: PresenceState;
}

export interface MessageDto {
  id: string;
  content: string;
  createdAt: number;
  editedAt: number | null;
  author: MessageAuthor | null;
  authorId: string;
  attachments: {
    storageId: string;
    name: string;
    size: number;
    mimeType: string;
    url: string | null;
  }[];
  reactions: { emoji: string; userIds: string[]; count: number; mine: boolean }[];
  replyTo: { id: string; excerpt: string; author: MessageAuthor | null } | null;
}

export interface MessageListResult {
  messages: MessageDto[];
  hasMore: boolean;
  oldest: number | null;
  lastReadAt: number;
}

export interface ReplyTarget {
  id: string;
  author: string;
  excerpt: string;
}

const QUICK_EMOJI = [
  "👍", "👎", "😂", "😮", "😍", "🔥", "🎉", "😭", "🙏", "👀",
  "✅", "❤️", "🚀", "😅", "🤝", "💡", "🏆", "😴", "🤔", "💬",
];

export function MessageList({
  containerType,
  containerId,
  serverId,
  canManageMessages,
  currentUserId,
  onReply,
  onReport,
  roleColors,
}: {
  containerType: "channel" | "conversation";
  containerId: string;
  serverId?: string;
  canManageMessages: boolean;
  currentUserId: string;
  onReply: (target: ReplyTarget) => void;
  onReport: (message: MessageDto) => void;
  roleColors?: Record<string, string>;
}) {
  const [olderPages, setOlderPages] = useState<MessageDto[][]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const latest = useQuery(api.messages.list, {
    containerType,
    containerId,
    limit: 50,
  }) as MessageListResult | undefined;

  const older = useQuery(
    api.messages.list,
    before === null
      ? "skip"
      : { containerType, containerId, before, limit: 50 },
  ) as MessageListResult | undefined;

  // Reset local history whenever the conversation changes.
  useEffect(() => {
    setOlderPages([]);
    setBefore(null);
  }, [containerId]);

  useEffect(() => {
    if (older && before !== null) {
      setOlderPages((pages) => [...pages, older.messages]);
      setBefore(null);
    }
  }, [older, before]);

  const messages = useMemo(() => {
    const map = new Map<string, MessageDto>();
    for (const page of olderPages) {
      for (const message of page) map.set(message.id, message);
    }
    for (const message of latest?.messages ?? []) map.set(message.id, message);
    return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  }, [olderPages, latest]);

  // Stick to the bottom when new messages arrive, but respect manual scrolling.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 220;
    if (nearBottom) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length]);

  const lastReadAt = latest?.lastReadAt ?? 0;
  const unreadFrom = messages.findIndex(
    (message) => message.createdAt > lastReadAt && lastReadAt > 0 && message.authorId !== currentUserId,
  );

  return (
    <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      {latest === undefined ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-center">
            {before === null && latest.hasMore ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => latest.oldest !== null && setBefore(latest.oldest)}
              >
                Load earlier messages
              </Button>
            ) : before !== null ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          {messages.length === 0 ? (
            <EmptyConversation containerType={containerType} />
          ) : (
            messages.map((message, index) => {
              const previous = messages[index - 1];
              const next = messages[index + 1];
              const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
              const grouped =
                !newDay &&
                previous?.authorId === message.authorId &&
                message.createdAt - previous.createdAt < 5 * 60_000 &&
                !previous.replyTo;
              const showUnreadDivider = unreadFrom === index && !grouped;

              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-border/70" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {dayLabel(message.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-border/70" />
                    </div>
                  )}
                  {showUnreadDivider && (
                    <div className="my-2 flex items-center gap-3">
                      <span className="h-px flex-1 bg-destructive/60" />
                      <span className="text-[11px] font-semibold uppercase text-destructive">
                        New messages
                      </span>
                      <span className="h-px flex-1 bg-destructive/60" />
                    </div>
                  )}
                  <MessageRow
                    message={message}
                    grouped={grouped}
                    containerType={containerType}
                    containerId={containerId}
                    serverId={serverId}
                    currentUserId={currentUserId}
                    canManageMessages={canManageMessages}
                    isLast={next === undefined || next.authorId !== message.authorId}
                    onReply={onReply}
                    onReport={onReport}
                    roleColors={roleColors}
                  />
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

function EmptyConversation({
  containerType,
}: {
  containerType: "channel" | "conversation";
}) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border/70 bg-surface p-6 text-center">
      <h3 className="text-lg font-semibold">
        {containerType === "channel" ? "This is the start of the channel" : "Say hello"}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {containerType === "channel"
          ? "Nothing has been said here yet. Send the first message — formatting, code blocks, replies and reactions all work."
          : "Messages you send here are private to this conversation and sync across your devices."}
      </p>
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  containerType,
  containerId,
  serverId,
  currentUserId,
  canManageMessages,
  isLast,
  onReply,
  onReport,
  roleColors,
}: {
  message: MessageDto;
  grouped: boolean;
  containerType: "channel" | "conversation";
  containerId: string;
  serverId?: string;
  currentUserId: string;
  canManageMessages: boolean;
  isLast: boolean;
  onReply: (target: ReplyTarget) => void;
  onReport: (message: MessageDto) => void;
  roleColors?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const isAuthor = message.authorId === currentUserId;
  const author = message.author;

  const send = async (emoji: string) => {
    try {
      await toggleReaction({ messageId: message.id as Id<"messages">, emoji });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not react.");
    }
  };

  return (
    <div
      className={cn(
        "message-row group relative rounded-md px-2 py-1.5 hover:bg-surface/60",
        grouped ? "mt-0" : "mt-3",
      )}
    >
      <div className="flex gap-3">
        <div className="w-10 shrink-0">
          {!grouped && author && (
            <UserAvatar
              user={author}
              size="md"
              showStatus={false}
              className="mt-0.5"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!grouped && (
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className="text-sm font-semibold hover:underline"
                style={
                  roleColors && author && roleColors[author.id]
                    ? { color: roleColors[author.id] }
                    : undefined
                }
              >
                {author?.name ?? "Unknown user"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {dayLabel(message.createdAt)} {formatTime(message.createdAt)}
              </span>
            </div>
          )}

          {message.replyTo && (
            <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CornerUpLeft className="size-3" />
              <span className="font-medium text-foreground/80">
                {message.replyTo.author?.name ?? "a message"}
              </span>
              <span className="truncate">{message.replyTo.excerpt}</span>
            </div>
          )}

          {editing ? (
            <div className="mt-1">
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={async (event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (draft.trim()) {
                      try {
                        await editMessage({
                          messageId: message.id as Id<"messages">,
                          content: draft,
                        });
                        setEditing(false);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not edit.",
                        );
                      }
                    }
                  }
                  if (event.key === "Escape") {
                    setDraft(message.content);
                    setEditing(false);
                  }
                }}
                rows={Math.min(6, draft.split("\n").length + 1)}
                className="w-full resize-none rounded-lg border border-primary/50 bg-surface p-2 text-sm outline-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter to save · Esc to cancel · Shift+Enter for a new line
              </p>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/95">
              {renderMessage(message.content)}
              {message.editedAt && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">(edited)</span>
              )}
            </div>
          )}

          {message.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {message.attachments.map((attachment) =>
                attachment.mimeType.startsWith("image/") && attachment.url ? (
                  <a
                    key={attachment.storageId}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border/70"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      loading="lazy"
                      className="max-h-72 max-w-xs object-cover"
                    />
                  </a>
                ) : (
                  <a
                    key={attachment.storageId}
                    href={attachment.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex max-w-xs items-center gap-2 rounded-lg border border-border/70 bg-surface px-3 py-2 text-xs hover:border-primary/40"
                  >
                    <span className="truncate font-medium">{attachment.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {Math.max(1, Math.round(attachment.size / 1024))} KB
                    </span>
                  </a>
                ),
              )}
            </div>
          )}

          {message.reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => void send(reaction.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    reaction.mine
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/70 bg-surface text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover toolbar */}
      <div className="message-toolbar absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-border/70 bg-panel px-1 py-0.5 shadow-lg">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add reaction"
              className="rounded p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <SmilePlus className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="grid grid-cols-10 gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void send(emoji)}
                  className="rounded p-1 text-lg hover:bg-surface"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          aria-label="Reply"
          onClick={() =>
            onReply({
              id: message.id,
              author: author?.name ?? "Unknown",
              excerpt: message.content.slice(0, 80),
            })
          }
          className="rounded p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <Reply className="size-4" />
        </button>

        {isAuthor && (
          <button
            type="button"
            aria-label="Edit message"
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
        )}

        {(isAuthor || canManageMessages) && (
          <button
            type="button"
            aria-label="Delete message"
            onClick={async () => {
              try {
                await deleteMessage({ messageId: message.id as Id<"messages"> });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not delete.",
                );
              }
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}

        {!isAuthor && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="rounded p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <span className="text-xs leading-none">⋯</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onReport(message)}>
                <AlertTriangle className="size-4" /> Report message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

