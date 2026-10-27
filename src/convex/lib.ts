import { getAuthUserId } from "@convex-dev/auth/server";
import {
  ALL_PERMISSIONS,
  hasPermission,
  type Permission,
} from "../lib/permissions";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Ctx = QueryCtx | MutationCtx;

/** A user is considered online if they heartbeated within this window. */
export const PRESENCE_TIMEOUT_MS = 60_000;

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ATTACHMENTS = 6;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function currentUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

export async function requireUser(
  ctx: Ctx,
): Promise<{ id: Id<"users">; user: Doc<"users"> }> {
  const id = await getAuthUserId(ctx);
  if (id === null) throw new Error("You need to sign in to do that.");
  const user = await ctx.db.get(id);
  if (!user) throw new Error("You need to sign in to do that.");
  return { id, user };
}

/** Someone who finished onboarding (claimed a unique username). */
export async function requireProfile(
  ctx: Ctx,
): Promise<{ id: Id<"users">; user: Doc<"users"> }> {
  const authed = await requireUser(ctx);
  if (!authed.user.username) {
    throw new Error("Claim a username before using Kyro.");
  }
  return authed;
}

export type PresenceState =
  | "online"
  | "idle"
  | "dnd"
  | "invisible"
  | "offline";

/** Resolves the presence a given viewer is allowed to see. */
export function visiblePresence(
  user: Doc<"users">,
  viewerIsSelf: boolean,
): PresenceState {
  const now = Date.now();
  if (user.showPresence === false && !viewerIsSelf) return "offline";
  if (user.status === "invisible") return viewerIsSelf ? "invisible" : "offline";
  if (user.status === "offline") return "offline";
  const recentlyActive =
    user.lastSeen !== undefined && now - user.lastSeen < PRESENCE_TIMEOUT_MS;
  if (!recentlyActive) return "offline";
  if (user.status === "idle" || user.status === "dnd") return user.status;
  return "online";
}

export interface PublicUser {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  presence: PresenceState;
  customStatus: string | null;
  bio: string | null;
  accent: string | null;
  lastSeen: number | null;
  isAnonymous: boolean;
  /** Kyro's founder: their crown badge is shown to every viewer, everywhere. */
  isFounder: boolean;
  /**
   * Global (platform-wide) badges shown in the profile's own badge shelf —
   * separate from community roles. Always in this order:
   * founder, admin, moderator, verified.
   */
  badges: GlobalBadge[];
  /** External links shown on the profile, in the order they were saved. */
  links: { label: string; url: string }[];
  /** Built-in avatar frame id, or null for a plain avatar. */
  avatarFrame: string | null;
  /** Account creation timestamp, shown as "member since" on profiles. */
  memberSince: number | null;
  /** Pronouns shown on the profile card, e.g. "He/Him". */
  pronouns: string | null;
  /** The badge this person chose to show next to their name in chat. */
  primaryBadge: string | null;
  /** Profile theme preset id, or null for the default look. */
  profileTheme: string | null;
  /** Community tag worn next to the name, or null. */
  serverTag: string | null;
}

/** The one account that carries Kyro's platform-wide founder crown. */
export const FOUNDER_USERNAME = "adrianeosyne";

/** A platform-wide badge; never scoped to a single community. */
export type GlobalBadge = "founder" | "admin" | "moderator" | "verified";

/**
 * Active (unexpired) staff warnings on an account: 0 = clean, 1 = limited,
 * 2 = very limited, 3+ = suspended. Powers account standing and the write
 * gates in messages.send / servers.create / social.sendRequest.
 */
export async function restrictionLevel(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("warnings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const now = Date.now();
  return rows.filter((row) => row.expiresAt > now).length;
}

export async function hydrateUser(
  ctx: Ctx,
  user: Doc<"users">,
  viewerId: Id<"users">,
): Promise<PublicUser> {
  const [avatarUrl, bannerUrl] = await Promise.all([
    user.avatarStorageId
      ? ctx.storage.getUrl(user.avatarStorageId)
      : Promise.resolve(null),
    user.bannerStorageId
      ? ctx.storage.getUrl(user.bannerStorageId)
      : Promise.resolve(null),
  ]);
  const isFounder =
    (user.username ?? "").toLowerCase() === FOUNDER_USERNAME;
  const badges: GlobalBadge[] = [];
  if (isFounder) badges.push("founder");
  // Kyro's founder runs the platform, so they carry the Admin badge too.
  if (user.role === "admin" || isFounder) badges.push("admin");
  if (user.siteModerator === true) badges.push("moderator");
  if (user.verified === true) badges.push("verified");
  return {
    id: user._id,
    username: user.username ?? null,
    name: user.name ?? user.username ?? "Kyro user",
    avatarUrl,
    bannerUrl,
    presence: visiblePresence(user, user._id === viewerId),
    customStatus: user.customStatus ?? null,
    bio: user.bio ?? null,
    accent: user.accent ?? null,
    lastSeen: user.lastSeen ?? null,
    isAnonymous: user.isAnonymous === true,
    isFounder,
    badges,
    links: (user.links ?? []).slice(0, 6),
    avatarFrame: user.avatarFrame ?? null,
    memberSince: user.createdAt ?? null,
    pronouns: user.pronouns ?? null,
    primaryBadge: user.primaryBadge ?? null,
    profileTheme: user.profileTheme ?? null,
    serverTag: user.wornTag ?? null,
  };
}

/** Resolves a batch of user ids into public profiles keyed by id. */
export async function hydrateUsers(
  ctx: Ctx,
  ids: (Id<"users"> | null | undefined)[],
  viewerId: Id<"users">,
): Promise<Map<string, PublicUser>> {
  const unique = Array.from(
    new Set(ids.filter((id): id is Id<"users"> => Boolean(id))),
  );
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const users = docs.filter((doc): doc is Doc<"users"> => doc !== null);
  const hydrated = await Promise.all(
    users.map((user) => hydrateUser(ctx, user, viewerId)),
  );
  return new Map(hydrated.map((user) => [user.id, user]));
}

export async function getUserByUsername(
  ctx: Ctx,
  username: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username.toLowerCase()))
    .unique();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export async function isBlockedBetween(
  ctx: Ctx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", a).eq("blockedId", b))
      .unique(),
    ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", b).eq("blockedId", a))
      .unique(),
  ]);
  return ab !== null || ba !== null;
}

export interface ServerAccess {
  server: Doc<"servers">;
  member: Doc<"serverMembers">;
  permissions: string[];
}

/** Membership + effective permissions for a community, or null. */
export async function getServerAccess(
  ctx: Ctx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<ServerAccess | null> {
  const server = await ctx.db.get(serverId);
  if (!server) return null;
  const member = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (!member) return null;
  return { server, member, permissions: await permissionsFor(ctx, server, member) };
}

export async function requireServerAccess(
  ctx: Ctx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<ServerAccess> {
  const access = await getServerAccess(ctx, serverId, userId);
  if (!access) throw new Error("You are not a member of this community.");
  return access;
}

/** Effective permission list: owner wins, then union of assigned roles. */
export async function permissionsFor(
  ctx: Ctx,
  server: Doc<"servers">,
  member: Doc<"serverMembers">,
): Promise<string[]> {
  if (server.ownerId === member.userId) return [...ALL_PERMISSIONS];
  const roles = await ctx.db
    .query("serverRoles")
    .withIndex("by_server", (q) => q.eq("serverId", server._id))
    .collect();
  const permissions = new Set<string>();
  for (const role of roles) {
    if (role.isDefault || member.roleIds.includes(role._id)) {
      for (const permission of role.permissions) permissions.add(permission);
    }
  }
  return Array.from(permissions);
}

export function can(permissions: string[], permission: Permission): boolean {
  return hasPermission(permissions, permission);
}

export function assertPermission(
  permissions: string[],
  permission: Permission,
): void {
  if (!hasPermission(permissions, permission)) {
    throw new Error("You do not have permission to do that.");
  }
}

export async function logAudit(
  ctx: MutationCtx,
  args: {
    serverId: Id<"servers">;
    actorId: Id<"users">;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    serverId: args.serverId,
    actorId: args.actorId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    details: args.details,
    createdAt: Date.now(),
  });
}

export async function notify(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: "friend_request" | "friend_accept" | "mention" | "reply" | "moderation" | "system";
    title: string;
    body?: string;
    actorId?: Id<"users">;
    link?: string;
    containerKey?: string;
  },
): Promise<void> {
  if (args.actorId && args.userId === args.actorId) return;
  const target = await ctx.db.get(args.userId);
  if (!target) return;
  await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    body: args.body,
    actorId: args.actorId,
    link: args.link,
    containerKey: args.containerKey,
    read: false,
    createdAt: Date.now(),
  });
}

/** Upserts the read cursor for a channel or conversation key. */
export async function markRead(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
  at = Date.now(),
): Promise<void> {
  const existing = await ctx.db
    .query("reads")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .unique();
  if (existing) {
    if (at >= existing.lastReadAt) {
      await ctx.db.patch(existing._id, { lastReadAt: at, updatedAt: Date.now() });
    }
    return;
  }
  await ctx.db.insert("reads", { userId, key, lastReadAt: at, updatedAt: Date.now() });
}

/** True when either user has blocked the other. Used by DM entry points. */
export async function canSendDirectMessage(
  ctx: Ctx,
  from: Id<"users">,
  to: Id<"users">,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (from === to) return { ok: false, reason: "You cannot message yourself." };
  if (await isBlockedBetween(ctx, from, to)) {
    return { ok: false, reason: "You cannot message this user." };
  }
  const target = await ctx.db.get(to);
  if (!target) return { ok: false, reason: "That user no longer exists." };
  const policy = target.dmPolicy ?? "everyone";
  if (policy === "nobody") {
    return { ok: false, reason: "This user is not accepting direct messages." };
  }
  if (policy === "friends") {
    const friendship =
      (await ctx.db
        .query("connections")
        .withIndex("by_requester_addressee", (q) =>
          q.eq("requesterId", from).eq("addresseeId", to),
        )
        .unique()) ??
      (await ctx.db
        .query("connections")
        .withIndex("by_requester_addressee", (q) =>
          q.eq("requesterId", to).eq("addresseeId", from),
        )
        .unique());
    if (!friendship || friendship.status !== "accepted") {
      return { ok: false, reason: "This user only accepts messages from friends." };
    }
  }
  return { ok: true };
}
