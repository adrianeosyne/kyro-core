import { useMutation, useQuery } from "convex/react";
import {
  Ban,
  Check,
  Clock,
  Link2,
  MessageCircle,
  Settings,
  UserPlus,
  X,
} from "@/components/icons";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UserAvatar } from "@/components/app/UserAvatar";
import {
  GlobalBadgeIcon,
  GlobalBadges,
  GLOBAL_BADGE_META,
  GRANTABLE_BADGES,
  InlineBadge,
} from "@/components/app/GlobalBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findProfileTheme } from "@/lib/profileThemes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRESENCE_META, formatRelative } from "@/lib/format";

/**
 * User profile popup. Opened anywhere by adding `?user=<id>` to the current
 * URL; it closes itself by removing the parameter again.
 */
export function ProfileCard() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = params.get("user");
  const [busy, setBusy] = useState(false);
  const me = useQuery(api.users.me);

  const profile = useQuery(
    api.users.profile,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const social = useQuery(
    api.social.mutualContext,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const lists = useQuery(api.social.list);

  const sendRequest = useMutation(api.social.sendRequest);
  const respond = useMutation(api.social.respond);
  const cancel = useMutation(api.social.cancel);
  const removeFriend = useMutation(api.social.removeFriend);
  const block = useMutation(api.social.block);
  const unblock = useMutation(api.social.unblock);
  const createDirect = useMutation(api.conversations.createDirect);
  const setBadges = useMutation(api.users.setBadges);
  const warn = useMutation(api.warnings.warn);
  const [warnReason, setWarnReason] = useState("");

  const close = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(params);
    next.delete("user");
    setParams(next, { replace: true });
  };

  const run = async (action: Promise<unknown>, successMessage?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action;
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openMessage = async () => {
    if (!userId) return;
    await run(
      createDirect({ userId: userId as Id<"users"> }).then((conversationId) => {
        close(false);
        navigate(`/dashboard/dm/${conversationId}`);
      }),
    );
  };

  if (!userId) return null;

  const isSelf = Boolean(me && me.id === userId);

  /** Your own profile offers settings instead of friend/block controls. */
  const openSettings = () => {
    const next = new URLSearchParams(params);
    next.delete("user");
    next.set("settings", "1");
    setParams(next, { replace: true });
  };

  const user = profile?.user;
  const incoming = lists?.incoming.find((row) => row.user?.id === userId);
  const outgoing = lists?.outgoing.find((row) => row.user?.id === userId);
  const isFriend = social?.friendship === "accepted";
  const isBlocked = (lists?.blocked ?? []).some((row) => row.user?.id === userId);
  /** Only site admins can grant or revoke global badges. */
  const canManageBadges = Boolean(me && (me.role === "admin" || me.isFounder));
  const presenceMeta = user
    ? PRESENCE_META[(user.presence as keyof typeof PRESENCE_META) ?? "offline"]
    : null;
  const profileTheme = findProfileTheme(user?.profileTheme);

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {user ? (
              <>
                <UserAvatar user={user} size="lg" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {user.name}
                    <InlineBadge
                      badges={user.badges}
                      primaryBadge={user.primaryBadge}
                    />
                    {user.serverTag && (
                      <span className="shrink-0 rounded border border-border/70 px-1 py-px text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {user.serverTag}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.username ? `@${user.username}` : "no username yet"}
                    {user.pronouns ? ` · ${user.pronouns}` : ""}
                  </p>
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Loading profile…</span>
            )}
          </DialogTitle>
          {user && presenceMeta && (
            <DialogDescription className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${presenceMeta.dot}`}
              />
              {user.customStatus || presenceMeta.label}
              {user.lastSeen != null && (
                <span className="text-muted-foreground/80">
                  · last seen {formatRelative(user.lastSeen)}
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {user && (
          <div className="space-y-3">
            {user.bannerUrl ? (
              <div className="h-24 overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-brand to-cyan">
                <img
                  src={user.bannerUrl}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            ) : profileTheme ? (
              <div
                aria-hidden="true"
                className={`h-24 rounded-lg border border-border/70 bg-gradient-to-br ${profileTheme.gradient}`}
              />
            ) : null}
            {user.bio && (
              <p className="rounded-md border border-border/70 bg-surface p-3 text-sm">
                {user.bio}
              </p>
            )}

            {/* Dedicated home for platform-wide badges — separate from
                community roles, which live in each server. */}
            <div className="rounded-md border border-border/70 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Global badges
              </p>
              <GlobalBadges badges={user.badges} className="mt-2" />

              {canManageBadges && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted-foreground">
                    You're an admin — tap a badge to grant or revoke it.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {GRANTABLE_BADGES.map((badge) => {
                      const granted = user.badges.includes(badge);
                      return (
                        <button
                          key={badge}
                          type="button"
                          disabled={busy}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                            granted
                              ? GLOBAL_BADGE_META[badge].chip
                              : "border-border/70 text-muted-foreground hover:text-foreground"
                          } ${busy ? "opacity-60" : ""}`}
                          onClick={() => {
                            void run(
                              setBadges({
                                userId: userId as Id<"users">,
                                [badge]: !granted,
                              }),
                              granted
                                ? `${GLOBAL_BADGE_META[badge].label} badge removed.`
                                : `${GLOBAL_BADGE_META[badge].label} badge granted.`,
                            );
                          }}
                        >
                          <GlobalBadgeIcon badge={badge} />
                          {GLOBAL_BADGE_META[badge].label}
                          <span aria-hidden="true" className="text-[10px]">
                            {granted ? "✓ grant" : "+ grant"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={warnReason}
                      onChange={(event) => setWarnReason(event.target.value)}
                      placeholder="Warning reason…"
                      maxLength={300}
                      className="h-8 flex-1 text-xs"
                      aria-label="Warning reason"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy || warnReason.trim().length < 3}
                      onClick={() => {
                        void run(
                          warn({
                            userId: userId as Id<"users">,
                            reason: warnReason.trim(),
                          }).then(() => setWarnReason("")),
                          "Warning issued — it counts for 3 days.",
                        );
                      }}
                    >
                      Warn
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {user.links.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Links
                </p>
                <div className="mt-1.5 space-y-1">
                  {user.links.map((link) => (
                    <a
                      key={`${link.label}:${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border/70 bg-surface px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40"
                    >
                      <Link2 className="size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {link.label}
                      </span>
                      <span className="max-w-32 shrink-0 truncate text-muted-foreground">
                        {link.url.replace(/^https?:\/\//, "")}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {user.memberSince != null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Member since
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {new Date(user.memberSince).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}

            {profile && profile.mutualServers.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mutual communities · {profile.mutualServers.length}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {profile.mutualServers.map((server) => (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => {
                        close(false);
                        navigate(`/dashboard/s/${server.id}`);
                      }}
                      className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-xs transition-colors hover:border-primary/40"
                    >
                      {server.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {social && !social.canMessage && social.messageReason && (
              <p className="text-xs text-muted-foreground">{social.messageReason}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
          {isSelf && (
            <Button variant="outline" onClick={openSettings}>
              <Settings className="mr-1.5 size-4" /> Edit profile
            </Button>
          )}

          {!isSelf && incoming && (
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(
                    respond({
                      connectionId: incoming.connectionId as Id<"connections">,
                      accept: false,
                    }),
                  )
                }
              >
                <X className="mr-1.5 size-4" /> Ignore
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    respond({
                      connectionId: incoming.connectionId as Id<"connections">,
                      accept: true,
                    }),
                    "You are now friends.",
                  )
                }
              >
                <Check className="mr-1.5 size-4" /> Accept
              </Button>
            </>
          )}

          {!isSelf && outgoing && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  cancel({
                    connectionId: outgoing.connectionId as Id<"connections">,
                  }),
                  "Request cancelled.",
                )
              }
            >
              <Clock className="mr-1.5 size-4" /> Cancel request
            </Button>
          )}

          {!isSelf && !incoming && !outgoing && !isFriend && !isBlocked && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  sendRequest({ userId: userId as Id<"users"> }),
                  "Friend request sent.",
                )
              }
            >
              <UserPlus className="mr-1.5 size-4" /> Add friend
            </Button>
          )}

          {!isSelf && isFriend && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(
                  removeFriend({ userId: userId as Id<"users"> }),
                  "Friend removed.",
                )
              }
            >
              Remove friend
            </Button>
          )}

          {!isSelf && (isBlocked ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  unblock({ userId: userId as Id<"users"> }),
                  "User unblocked.",
                )
              }
            >
              Unblock
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(block({ userId: userId as Id<"users"> }), "User blocked.")
              }
            >
              <Ban className="mr-1.5 size-4" /> Block
            </Button>
          ))}

          {!isSelf && (
            <Button
              disabled={busy || (social ? !social.canMessage : false)}
              onClick={() => void openMessage()}
            >
              <MessageCircle className="mr-1.5 size-4" /> Message
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
