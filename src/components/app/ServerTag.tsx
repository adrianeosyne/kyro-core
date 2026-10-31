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
import { Hash, Loader2, Users } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The community tag worn next to a name. It is a real control: tapping it
 * opens a preview of the community behind it — name, description, member
 * count and owner — with a jump straight into it.
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {preview?.iconUrl ? (
                <img
                  src={preview.iconUrl}
                  alt=""
                  className="size-10 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-muted-foreground">
                  <Hash className="size-5" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate">
                  {preview === undefined ? "Loading…" : preview?.name ?? "Community not found"}
                </span>
                {preview?.tag && (
                  <span className="block text-xs font-medium text-muted-foreground">
                    Tag · {preview.tag}
                  </span>
                )}
              </span>
            </DialogTitle>
            {preview?.description && (
              <DialogDescription className="text-sm">
                {preview.description}
              </DialogDescription>
            )}
          </DialogHeader>

          {preview === undefined ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : preview === null ? (
            <p className="py-4 text-sm text-muted-foreground">
              No community is wearing this tag right now.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border/60 bg-panel p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Members
                  </p>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Users className="size-3.5 text-muted-foreground" />
                    {preview.memberCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-panel p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Owner
                  </p>
                  <p className="truncate font-semibold">{preview.ownerName}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    navigate(`/dashboard/s/${preview.id}`);
                  }}
                >
                  Open community
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
