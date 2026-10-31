import { useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Hash, Loader2 } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The community tag worn next to a name. It is a real control: tapping it
 * opens a preview of the community behind it — icon, tag, name, member
 * count and description — with a jump straight into it.
 */
export function ServerTagChip({
  tag,
  ownerName,
  className,
}: {
  tag: string;
  /** Who wears the tag — used in the accessible label. */
  ownerName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const preview = useQuery(
    api.servers.previewByTag,
    open ? { tag } : "skip",
  );

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title={`Community tag “${tag}”${
          ownerName ? ` — worn by ${ownerName}` : ""
        }. Click to preview the community.`}
        className={cn(
          "shrink-0 cursor-pointer rounded border border-border/70 bg-surface px-1 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground",
          className,
        )}
      >
        {tag}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[22rem] rounded-2xl p-6 text-center sm:p-8">
          <DialogHeader className="flex flex-col items-center gap-3 text-center sm:text-center">
            {/* Big icon — the centrepiece of the preview. */}
            {preview === undefined ? (
              <span className="flex size-24 items-center justify-center rounded-3xl bg-surface">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </span>
            ) : preview?.iconUrl ? (
              <img
                src={preview.iconUrl}
                alt=""
                className="size-24 rounded-3xl object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-3xl bg-surface text-muted-foreground">
                <Hash className="size-10" />
              </span>
            )}

            {/* The tag itself, styled like the chip users saw before. */}
            {preview?.tag && (
              <span className="inline-flex items-center rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-100 ring-1 ring-white/10">
                {preview.tag}
              </span>
            )}

            <DialogTitle className="text-2xl leading-tight">
              {preview === undefined
                ? "Loading community…"
                : (preview?.name ?? "Community not found")}
            </DialogTitle>

            {preview != null && (
              <>
                <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground/80">
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-emerald-500"
                  />
                  {preview.memberCount.toLocaleString()} Members
                </p>
                {preview.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {preview.description}
                  </p>
                ) : null}
              </>
            )}
            {/* Screen-reader text for the whole preview. */}
            <DialogDescription className="sr-only">
              Community preview of the tag {tag}
            </DialogDescription>
          </DialogHeader>

          {preview === undefined ? null : preview === null ? (
            <p className="py-2 text-sm text-muted-foreground">
              No community is wearing this tag right now.
            </p>
          ) : (
            <Button
              className="w-full rounded-xl py-3 text-base font-bold"
              onClick={() => {
                setOpen(false);
                navigate(`/dashboard/s/${preview.id}`);
              }}
            >
              Open server
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
