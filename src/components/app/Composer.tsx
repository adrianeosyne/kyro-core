import { useMutation } from "convex/react";
import { Paperclip, Send, Smile, X } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReplyTarget } from "@/components/app/MessageList";
import { formatBytes } from "@/lib/format";
import { useUiStore } from "@/lib/store";
import {
  ACCEPTED_UPLOAD,
  MAX_ATTACHMENTS,
  useUploadFile,
  type PendingAttachment,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_EMOJI = [
  "😀", "😂", "🙂", "😍", "😎", "🤔", "😴", "😭", "😡", "🥳",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "✨", "🎉", "❤️", "💀",
  "🎮", "🏆", "🚀", "⚡", "🌙", "☕", "🍕", "🎧", "💬", "👀",
];

export function Composer({
  containerType,
  containerId,
  reply,
  onCancelReply,
  disabledReason,
  onSent,
}: {
  containerType: "channel" | "conversation";
  containerId: string;
  reply: ReplyTarget | null;
  onCancelReply: () => void;
  disabledReason?: string | null;
  onSent?: () => void;
}) {
  const draftKey = `${containerType}:${containerId}`;
  const draft = useUiStore((state) => state.drafts[draftKey] ?? "");
  const setDraft = useUiStore((state) => state.setDraft);
  const sendMessage = useMutation(api.messages.send);
  const setTyping = useMutation(api.messages.setTyping);
  const upload = useUploadFile();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [draft]);

  const send = async () => {
    const content = draft.trim();
    if (!content && attachments.length === 0) return;
    if (busy) return;
    setBusy(true);
    const clientId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    try {
      await sendMessage({
        containerType,
        containerId,
        content,
        clientId,
        replyToId: reply?.id as Id<"messages"> | undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setDraft(draftKey, "");
      setAttachments([]);
      onCancelReply();
      onSent?.();
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message failed to send.");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    setUploading((count) => count + chosen.length);
    for (const file of chosen) {
      try {
        const stored = await upload(file);
        setAttachments((state) => [...state, stored]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };

  if (disabledReason) {
    return (
      <div className="border-t border-border/60 bg-panel px-4 py-4 text-center text-sm text-muted-foreground">
        {disabledReason}
      </div>
    );
  }

  return (
    <div className="border-t border-border/60 bg-panel px-3 pb-4 pt-2 sm:px-6">
      {reply && (
        <div className="mb-1 flex items-center justify-between rounded-t-lg border border-b-0 border-border/70 bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            Replying to <span className="font-medium text-foreground">{reply.author}</span>
            {" — "}
            <span className="truncate">{reply.excerpt}</span>
          </span>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="rounded p-0.5 hover:bg-background"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-t-lg border border-b-0 border-border/70 bg-surface p-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.storageId}
              className="flex items-center gap-2 rounded-md border border-border/70 bg-panel px-2 py-1 text-xs"
            >
              <span className="max-w-40 truncate">{attachment.name}</span>
              <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                onClick={() =>
                  setAttachments((state) =>
                    state.filter((item) => item.storageId !== attachment.storageId),
                  )
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {uploading > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Uploading {uploading}…
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-1 rounded-lg border border-input bg-surface px-2 py-1.5 focus-within:border-primary/60",
          (attachments.length > 0 || reply) && "rounded-t-none",
        )}
      >
        <label
          className="cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
          title="Attach files"
        >
          <Paperclip className="size-4" />
          <input
            type="file"
            multiple
            accept={ACCEPTED_UPLOAD}
            className="hidden"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => {
            setDraft(draftKey, event.target.value);
            const now = Date.now();
            if (now - lastTypingRef.current > 4000) {
              lastTypingRef.current = now;
              void setTyping({ containerType, containerId }).catch(() => undefined);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Message…"
          className="max-h-56 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
        />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Emoji"
              className="rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Smile className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="grid grid-cols-10 gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded p-1 text-lg hover:bg-surface"
                  onClick={() => {
                    setDraft(draftKey, `${draft}${emoji}`);
                    textareaRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => void send()}
          disabled={busy || (!draft.trim() && attachments.length === 0)}
          aria-label="Send message"
          className="text-primary hover:bg-primary/10"
        >
          <Send className="size-4" />
        </Button>
      </div>

      <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">
        <span className="rounded border border-border/70 px-1">Enter</span> to send ·{" "}
        <span className="rounded border border-border/70 px-1">Shift+Enter</span> for a
        new line · Markdown and code blocks supported
      </p>
    </div>
  );
}
