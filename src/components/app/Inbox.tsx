import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck, MailOpen } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";

/** Notification inbox: mentions, replies, friend requests and moderation. */
export function Inbox({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notes = useQuery(api.notifications.list, { limit: 50 });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();

  const openNote = async (note: { id: string; read: boolean; link: string | null }) => {
    if (!note.read) await markRead({ ids: [note.id as never] });
    onOpenChange(false);
    if (note.link) navigate(note.link);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:w-96">
        <SheetHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="size-4" /> Inbox
            </SheetTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void markAllRead()}
              disabled={!notes?.some((note) => !note.read)}
            >
              <CheckCheck className="mr-1.5 size-4" />
              Mark all read
            </Button>
          </div>
          <SheetDescription className="sr-only">
            Mentions, replies, friend requests and moderation updates.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {notes === undefined ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <MailOpen className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nothing here yet. Mentions, replies and friend requests land in
                this inbox.
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => void openNote(note)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-surface",
                  !note.read && "bg-primary/5",
                )}
              >
                {note.actor ? (
                  <UserAvatar user={note.actor} size="sm" showStatus={false} />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-surface text-xs">
                    {note.type === "moderation" ? "🛡" : "🔔"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">
                    {note.title}
                  </span>
                  {note.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {note.body}
                    </span>
                  )}
                  <span className="mt-1 block text-[11px] text-muted-foreground/80">
                    {formatRelative(note.createdAt)}
                  </span>
                </span>
                {!note.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
