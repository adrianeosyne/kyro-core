import { useMutation, useQuery } from "convex/react";
import { Compass, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { KyroMark } from "@/components/KyroMark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CreateCommunityDialog } from "@/components/app/dialogs";

function RailButton({
  label,
  active,
  unread,
  mentions,
  onClick,
  to,
  children,
  className,
}: {
  label: string;
  active: boolean;
  unread?: boolean;
  mentions?: number;
  onClick?: () => void;
  to?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const body = (
    <span
      className={cn(
        "relative flex size-12 items-center justify-center overflow-hidden rounded-2xl transition-all duration-200",
        active
          ? "rounded-xl bg-surface text-foreground"
          : "rounded-2xl bg-surface/70 text-muted-foreground hover:rounded-xl hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      {children}
      {mentions !== undefined && mentions > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white ring-2 ring-rail">
          {mentions > 9 ? "9+" : mentions}
        </span>
      )}
      {(!mentions || mentions === 0) && unread && (
        <span className="absolute -left-1 top-1/2 h-2 w-1 -translate-y-1/2 rounded-full bg-foreground" />
      )}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to ? (
          <Link to={to} aria-label={label} className="block">
            {body}
          </Link>
        ) : (
          <button type="button" aria-label={label} onClick={onClick} className="block">
            {body}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ServerRail({ activeServerId }: { activeServerId?: string }) {
  const servers = useQuery(api.servers.listMine);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Communities"
        className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden bg-rail py-3"
      >
        <RailButton
          label="Direct messages"
          active={!activeServerId}
          to="/dashboard"
        >
          <KyroMark className="size-7" />
        </RailButton>

        <span className="my-1 h-px w-8 bg-border" />

        {servers === undefined ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : servers.length === 0 ? (
          <span className="w-full px-2 text-center text-[10px] leading-tight text-muted-foreground">
            No communities yet
          </span>
        ) : (
          servers.map((server) => (
            <RailButton
              key={server.id}
              label={server.name}
              active={activeServerId === server.id}
              unread={server.unread && !server.muted}
              mentions={server.muted ? 0 : server.mentions}
              to={`/dashboard/s/${server.id}`}
            >
              {server.iconUrl ? (
                <img
                  src={server.iconUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand to-cyan text-xs font-bold text-white">
                  {server.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </RailButton>
          ))
        )}

        <RailButton label="Create a community" active={false} onClick={() => setCreateOpen(true)}>
          <Plus className="size-5" />
        </RailButton>
        <RailButton label="Explore communities" active={false} onClick={() => setDiscoverOpen(true)}>
          <Compass className="size-5" />
        </RailButton>
      </nav>

      <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DiscoverDialog open={discoverOpen} onOpenChange={setDiscoverOpen} onJoin={(id) => navigate(`/dashboard/s/${id}`)} />
    </>
  );
}

function DiscoverDialog({
  open,
  onOpenChange,
  onJoin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (serverId: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const results = useQuery(api.servers.discover, { term: debounced });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Explore communities</DialogTitle>
          <DialogDescription>
            Public Kyro communities you can join right now — all free, no invites
            required.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search communities…"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            window.setTimeout(() => setDebounced(event.target.value), 250);
          }}
        />
        <div className="grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {results === undefined ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No public communities matched that search. Why not create one?
            </p>
          ) : (
            results.map((server) => (
              <div
                key={server.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface p-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand to-cyan text-xs font-bold text-white">
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" className="size-full object-cover" />
                  ) : (
                    server.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{server.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {server.memberCount} member{server.memberCount === 1 ? "" : "s"}
                    {server.description ? ` · ${server.description}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => onJoin(server.id)}>
                  Join
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
