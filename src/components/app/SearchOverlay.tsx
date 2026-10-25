import { useMutation } from "convex/react";
import { useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelative } from "@/lib/format";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Check, X } from "lucide-react";
import { sendFriendRequest } from "@/components/app/hooks/social";
import { sendRespondsocial, sendBlock, sendUnblock, sendCreateDirect } from "@/components/app/hooks/social";

const sendFriendRequest = api.social.sendRequest;
const sendRespondsocial = api.social.respond;
const sendBlock = api.social.block;
const sendUnblock = api.social.unblock;
const sendCreateDirect = api.conversations.createDirect;

export function ProfileCard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [params] = useSearchParams();
  const userId = params.get("user");
  useEffect(() => { if (!userId) onOpenChange(false); }, [userId, onOpenChange]);
  if (!userId) return null;

  const profile = useQuery(
    userId ? { userId: userId as Id<"users"> } : "skip",
    userId as Id<"users">,
  );
  const social = useQuery(
    userId ? { userId: userId as Id<"users"> } : "skip",
    userId as Id<"users"> ? userId as Id<"users"> : undefined,
  );
  if (!profile?.user) return null;

  const isFriend = social?.friendship === "accepted";
  const pendingOut = (social?.outgoing ?? []).find((r: any) => (r as any)?._id === userId);
  const pendingIn = (social?.incoming ?? []).find((r: any) => (r as any)?._id === userId);
  const canDM = userId !== (profile.user._id ?? "");
  const [creating, setCreating] = useState(false);

  async sendMessage() {
    if (creating || !userId) return;
    setCreating(true);
    try {
      const convId = await sendCreateDirect.mutateAsync({ userId: userId as Id<"users"> });
      if (!convId) return;
      window.location.assign(`/dashboard/dm/${convId}`);
    } catch (e) { toast.error((e as Error)?.message ?? "Could not open DM."); }
    finally { setCreating(false); }
  }

  async function sendFriendRequest() {
    if (!userId) return;
    try { await sendFriendRequest.mutateAsync({ userId: userId as Id<"users"> }); }
    catch (e) { toast.error((e as Error)?.message ?? "Could not send request."); }
  }

  async function sendRespond(connId: Id<"connections"> | null, accept: boolean) {
    if (!connId) return;
    try { await sendRespondsocial.mutateAsync({ connectionId: connId, accept }); }
    catch (e) { toast.error((e as Error)?.message ?? "Could not respond."); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar user={profile.user} size="lg" />
            <div>
              <p className="font-semibold truncate">{profile.user.name}</p>
              <p className="text-sm text-muted-foreground truncate">@{profile.user.username}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[220px]">
          <div className="px-1 space-y-2">
            {profile.user.bio && <p className="rounded-md border border-border/70 bg-surface p-3 text-sm">{profile.user.bio}</p>}
            {profile.user.customStatus && <p className="text-sm text-muted-foreground">{profile.user.customStatus}</p>}
            {profile.user.lastSeen != null && <p className="text-xs text-muted-foreground">Last seen {formatRelative(Number(profile.user.lastSeen))}</p>}
            <div className="mt-3 border-t border-border/70 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shared communities</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(social?.mutualServers ?? []).map((s: any, i: any) => <span key={s?.id ?? i} className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-xs">{s?.name ?? ""}</span>)}
              </div>
            </div>
            {(social as any)?.friends?.slice(0, 8).map((f: any, i: any) => <UserAvatar key={f?._id ?? i} user={f} size="sm" className="opacity-90" />)}
            {(social as any)?.friends?.length > 8 && <span className="rounded-md border border-border/70 bg-surface px-2 py-1 text-xs text-muted-foreground">+{(social as any).friends.length - 8}</span>}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2">
          {isFriend ? (<Button variant="ghost" onClick={onOpenChange}>Close</Button>)
          ) : pendingIn ? (
            <>
              <Button variant="ghost" onClick={() => void sendRespondsocial.mutateAsync({ connectionId: pendingIn!._id, accept: false })}><X className="mr-2 size-4" /> Ignore</Button>
              <Button onClick={() => void sendRespondsocial.mutateAsync({ connectionId: pendingIn!._id, accept: true })}><Check className="mr-2 size-4" /> Accept</Button>
            </>
          ) : pendingOut ? (
            <Button variant="ghost" onClick={() => void sendRespondsocial.mutateAsync({ connectionId: pendingOut!._id, accept: false })}><X className="mr-2 size-4" /> Cancel</Button>
          ) : canDM ? (
            <Button onClick={sendMessage}><Send className="mr-2 size-4" /> Message</Button>
          ) : (
            <Button variant="outline" onClick={sendFriendRequest}>Add friend</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
