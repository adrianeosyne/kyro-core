import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  FOUNDER_USERNAME,
  hydrateUser,
  hydrateUsers,
  normalizeUsername,
  requireUser,
  USERNAME_PATTERN,
} from "./lib";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Users can change their handle once every hour. */
const USERNAME_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Full profile for the signed-in account, with the avatar resolved to a
 * signed URL. This is what the app renders in the user panel and settings.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireUser(ctx);
    const publicUser = await hydrateUser(ctx, user, id);
    return {
      ...publicUser,
      email: user.email ?? null,
      dmPolicy: user.dmPolicy ?? ("everyone" as const),
      allowFriendRequests: user.allowFriendRequests !== false,
      showPresence: user.showPresence !== false,
      createdAt: user.createdAt ?? null,
      role: user.role ?? null,
      hasUsername: Boolean(user.username),
      usernameChangedAt: user.usernameChangedAt ?? null,
    };
  },
});

/** Finalises onboarding: claims a unique handle and display name. */
export const claimProfile = mutation({
  args: {
    username: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { username, name }) => {
    const { id, user } = await requireUser(ctx);
    const handle = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(handle)) {
      throw new Error(
        "Usernames are 3–32 characters and use lowercase letters, numbers or underscores.",
      );
    }
    if (user.username && user.username !== handle) {
      const changedAt = user.usernameChangedAt ?? 0;
      if (Date.now() - changedAt < USERNAME_COOLDOWN_MS) {
        throw new Error("Usernames can only be changed once every hour.");
      }
    }
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", handle))
      .unique();
    if (taken && taken._id !== id) {
      throw new Error("That username is already taken.");
    }
    const displayName = (name ?? user.name ?? handle).trim().slice(0, 64);
    await ctx.db.patch(id, {
      username: handle,
      name: displayName || handle,
      usernameChangedAt: user.username === handle ? user.usernameChangedAt : Date.now(),
      createdAt: user.createdAt ?? Date.now(),
      status: user.status ?? "online",
      lastSeen: Date.now(),
    });
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    customStatus: v.optional(v.string()),
    accent: v.optional(v.string()),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    bannerStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    links: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ),
    avatarFrame: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(
      v.literal("online"),
      v.literal("idle"),
      v.literal("dnd"),
      v.literal("invisible"),
      v.literal("offline"),
    )),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireUser(ctx);
    const patch: Partial<Doc<"users">> = {};
    if (args.name !== undefined) {
      const name = args.name.trim().slice(0, 64);
      if (name.length < 2) throw new Error("Display names need at least 2 characters.");
      patch.name = name;
    }
    if (args.bio !== undefined) patch.bio = args.bio.trim().slice(0, 400);
    if (args.customStatus !== undefined) {
      patch.customStatus = args.customStatus.trim().slice(0, 100);
    }
    if (args.accent !== undefined) {
      if (args.accent && !/^#[0-9a-fA-F]{6}$/.test(args.accent)) {
        throw new Error("Accent must be a hex colour like #67E8F9.");
      }
      patch.accent = args.accent || undefined;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
      patch.lastSeen = Date.now();
    }
    if (args.avatarStorageId !== undefined) {
      if (args.avatarStorageId === null) {
        if (user.avatarStorageId) await ctx.storage.delete(user.avatarStorageId);
        patch.avatarStorageId = undefined;
      } else {
        patch.avatarStorageId = args.avatarStorageId;
      }
    }
    if (args.bannerStorageId !== undefined) {
      if (args.bannerStorageId === null) {
        if (user.bannerStorageId) await ctx.storage.delete(user.bannerStorageId);
        patch.bannerStorageId = undefined;
      } else {
        patch.bannerStorageId = args.bannerStorageId;
      }
    }
    if (args.links !== undefined) {
      if (args.links.length > 6) {
        throw new Error("You can keep up to 6 profile links.");
      }
      const links = args.links
        .map((link) => ({
          label: link.label.trim().slice(0, 32),
          url: link.url.trim().slice(0, 200),
        }))
        .filter((link) => link.label.length > 0 && link.url.length > 0);
      for (const link of links) {
        if (!/^https?:\/\//i.test(link.url)) {
          throw new Error(
            `Links need to start with http:// or https:// — check "${link.label}".`,
          );
        }
      }
      patch.links = links;
    }
    if (args.avatarFrame !== undefined) {
      // Keep in sync with AVATAR_FRAMES in src/lib/frames.ts.
      const knownFrames = ["ember", "aqua", "forest", "kyro", "gold", "rose"];
      patch.avatarFrame =
        args.avatarFrame && knownFrames.includes(args.avatarFrame)
          ? args.avatarFrame
          : undefined;
    }
    await ctx.db.patch(id, patch);
  },
});

/**
 * Grant or revoke a user's platform-wide badges: Admin (site role),
 * Moderator and Verified (dedicated flags). The Founder badge is derived
 * from the account's username, so it can never be set here. Only site
 * admins may call this.
 */
export const setBadges = mutation({
  args: {
    userId: v.id("users"),
    admin: v.optional(v.boolean()),
    moderator: v.optional(v.boolean()),
    verified: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, admin, moderator, verified }) => {
    const { id, user } = await requireUser(ctx);
    const isAdmin =
      user.role === "admin" ||
      (user.username ?? "").toLowerCase() === FOUNDER_USERNAME;
    if (!isAdmin) throw new Error("Only admins can manage global badges.");
    if (admin === undefined && moderator === undefined && verified === undefined) {
      throw new Error("Nothing to update.");
    }
    if (admin === false && userId === id) {
      throw new Error("You can't remove your own Admin badge.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("That user no longer exists.");
    const patch: Partial<Doc<"users">> = {};
    if (admin !== undefined) patch.role = admin ? "admin" : "user";
    if (moderator !== undefined) patch.siteModerator = moderator;
    if (verified !== undefined) patch.verified = verified;
    await ctx.db.patch(userId, patch);
  },
});

/** Presence heartbeat + explicit status selection. */
export const setPresence = mutation({
  args: {
    status: v.union(
      v.literal("online"),
      v.literal("idle"),
      v.literal("dnd"),
      v.literal("invisible"),
      v.literal("offline"),
    ),
  },
  handler: async (ctx, { status }) => {
    const { id } = await requireUser(ctx);
    await ctx.db.patch(id, { status, lastSeen: Date.now() });
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireUser(ctx);
    const status =
      user.status === "idle" || user.status === "dnd" || user.status === "invisible"
        ? user.status
        : "online";
    await ctx.db.patch(id, { lastSeen: Date.now(), status });
  },
});

export const updatePrivacy = mutation({
  args: {
    dmPolicy: v.optional(
      v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody")),
    ),
    allowFriendRequests: v.optional(v.boolean()),
    showPresence: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await ctx.db.patch(id, args);
  },
});

/** Public profile for popovers and profile pages. */
export const profile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { id: viewerId } = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const publicUser = await hydrateUser(ctx, user, viewerId);
    const [mine, theirs] = await Promise.all([
      ctx.db
        .query("serverMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
      ctx.db
        .query("serverMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const theirServers = new Map(theirs.map((m) => [m.serverId, m]));
    const mutual: { id: string; name: string }[] = [];
    for (const membership of mine) {
      const server = theirServers.get(membership.serverId);
      if (!server) continue;
      const doc = await ctx.db.get(membership.serverId);
      if (doc) mutual.push({ id: doc._id, name: doc.name });
    }
    return { user: publicUser, mutualServers: mutual.slice(0, 8) };
  },
});

/** Username-prefix search used by "add friend" and the global search palette. */
export const searchUsers = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { term, limit }) => {
    const { id: viewerId } = await requireUser(ctx);
    const needle = normalizeUsername(term);
    if (!needle) return [];
    const results = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", needle).lt("username", needle + "\uffff"),
      )
      .take(Math.min(limit ?? 12, 25));
    const users = await hydrateUsers(
      ctx,
      results.map((u) => u._id),
      viewerId,
    );
    return results
      .map((u) => users.get(u._id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u) && u!.id !== viewerId);
  },
});

/** Global search across communities and DMs this user can actually access. */
export const searchMessages = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { term, limit }) => {
    const { id: viewerId } = await requireUser(ctx);
    const needle = term.trim();
    if (needle.length < 2) return [];

    const [memberships, conversations] = await Promise.all([
      ctx.db
        .query("serverMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
      ctx.db
        .query("conversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", viewerId))
        .collect(),
    ]);
    const channelIds = new Set<string>();
    for (const membership of memberships) {
      const channels = await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", membership.serverId))
        .collect();
      for (const channel of channels) channelIds.add(channel._id);
    }
    const conversationIds = new Set(conversations.map((c) => c.conversationId));
    conversationIds.forEach((id) => channelIds.add(id));

    const hits = await ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => q.search("content", needle))
      .take(150);

    const allowed = hits.filter((m) => channelIds.has(m.containerId));
    const scoped = allowed.slice(0, Math.min(limit ?? 25, 50));

    const authors = await hydrateUsers(
      ctx,
      scoped.map((m) => m.authorId),
      viewerId,
    );
    return await Promise.all(
      scoped.map(async (message) => {
        const isChannel = message.containerType === "channel";
        const container = isChannel
          ? await ctx.db.get(message.containerId as Id<"channels">)
          : await ctx.db.get(message.containerId as Id<"conversations">);
        return {
          message: {
            id: message._id,
            content: message.content.slice(0, 400),
            createdAt: message.createdAt,
            containerType: message.containerType,
            containerId: message.containerId,
            author: authors.get(message.authorId) ?? null,
          },
          serverId:
            isChannel && container ? ((container as Doc<"channels">).serverId as string) : null,
          containerName: container && "name" in container ? container.name : null,
        };
      }),
    );
  },
});

/** Active sessions for this account, with the current one flagged. */
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const current = await getAuthSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", id))
      .collect();
    return sessions
      .map((session) => ({
        id: session._id,
        expirationTime: session.expirationTime,
        current: session._id === current,
      }))
      .sort((a, b) => b.expirationTime - a.expirationTime);
  },
});

export const revokeSession = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, { sessionId }) => {
    const { id } = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== id) throw new Error("Session not found.");
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(sessionId);
  },
});

export const revokeOtherSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const current = await getAuthSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", id))
      .collect();
    for (const session of sessions) {
      if (session._id === current) continue;
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }
  },
});

/** GDPR-style export: everything Kyro stores about this account. */
export const exportData = mutation({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireUser(ctx);
    const [outgoing, incoming, blocks, memberships, ownedServers, messages, notes, reads] =
      await Promise.all([
        ctx.db
          .query("connections")
          .withIndex("by_requester", (q) => q.eq("requesterId", id))
          .collect(),
        ctx.db
          .query("connections")
          .withIndex("by_addressee", (q) => q.eq("addresseeId", id))
          .collect(),
        ctx.db
          .query("blocks")
          .withIndex("by_blocker", (q) => q.eq("blockerId", id))
          .collect(),
        ctx.db
          .query("serverMembers")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .collect(),
        ctx.db
          .query("servers")
          .withIndex("by_owner", (q) => q.eq("ownerId", id))
          .collect(),
        ctx.db
          .query("messages")
          .withIndex("by_author", (q) => q.eq("authorId", id))
          .take(5000),
        ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .take(1000),
        ctx.db
          .query("reads")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .collect(),
      ]);

    const connections = [...outgoing, ...incoming];
    const relevantConnections = connections;
    const friendIds = relevantConnections.map((c) =>
      c.requesterId === id ? c.addresseeId : c.requesterId,
    );
    const friendDocs = await Promise.all(friendIds.map((fid) => ctx.db.get(fid)));

    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        username: user.username,
        name: user.name,
        bio: user.bio,
        email: user.email,
        status: user.status,
        customStatus: user.customStatus,
        createdAt: user.createdAt,
      },
      friends: friendDocs
        .filter((doc): doc is Doc<"users"> => Boolean(doc))
        .map((doc) => ({ username: doc.username, name: doc.name })),
      blocks: await Promise.all(
        blocks.map(async (block) => {
          const doc = await ctx.db.get(block.blockedId);
          return { username: doc?.username ?? null, name: doc?.name ?? null };
        }),
      ),
      communities: {
        memberOf: await Promise.all(
          memberships.map(async (m) => {
            const doc = await ctx.db.get(m.serverId);
            return doc?.name ?? null;
          }),
        ),
        owns: ownedServers.map((s) => s.name),
      },
      messages: messages.map((m) => ({
        containerType: m.containerType,
        containerId: m.containerId,
        content: m.content,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
      notifications: notes.map((n) => ({
        type: n.type,
        title: n.title,
        read: n.read,
        createdAt: new Date(n.createdAt).toISOString(),
      })),
      readCursors: reads.length,
    };
    return payload;
  },
});

/** Permanently removes the account and everything it owns. */
export const deleteAccount = mutation({
  args: { confirm: v.string() },
  handler: async (ctx, { confirm }) => {
    const { id, user } = await requireUser(ctx);
    if (confirm !== "DELETE") {
      throw new Error('Type DELETE to confirm account deletion.');
    }
    const owned = await ctx.db
      .query("servers")
      .withIndex("by_owner", (q) => q.eq("ownerId", id))
      .collect();
    if (owned.length > 0) {
      throw new Error(
        "Transfer or delete the communities you own before deleting your account.",
      );
    }

    const [memberships, notes, reads, outgoing, incoming, blocks, sessions, accounts] =
      await Promise.all([
        ctx.db.query("serverMembers").withIndex("by_user", (q) => q.eq("userId", id)).collect(),
        ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", id)).collect(),
        ctx.db.query("reads").withIndex("by_user", (q) => q.eq("userId", id)).collect(),
        ctx.db
          .query("connections")
          .withIndex("by_requester", (q) => q.eq("requesterId", id))
          .collect(),
        ctx.db
          .query("connections")
          .withIndex("by_addressee", (q) => q.eq("addresseeId", id))
          .collect(),
        ctx.db.query("blocks").withIndex("by_blocker", (q) => q.eq("blockerId", id)).collect(),
        ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", id)).collect(),
        ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => q.eq("userId", id))
          .collect(),
      ]);

    for (const membership of memberships) await ctx.db.delete(membership._id);
    for (const note of notes) await ctx.db.delete(note._id);
    for (const read of reads) await ctx.db.delete(read._id);
    const connections = [...outgoing, ...incoming];
    for (const connection of connections) {
      if (connection.requesterId === id || connection.addresseeId === id) {
        await ctx.db.delete(connection._id);
      }
    }
    for (const block of blocks) await ctx.db.delete(block._id);

    const ownMessages = await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("authorId", id))
      .take(5000);
    for (const message of ownMessages) {
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const reaction of reactions) await ctx.db.delete(reaction._id);
      await ctx.db.delete(message._id);
    }

    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }
    for (const account of accounts) await ctx.db.delete(account._id);
    if (user.avatarStorageId) await ctx.storage.delete(user.avatarStorageId);
    await ctx.db.delete(id);
  },
});

/** Small helper used by the onboarding screen to check availability. */
export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const handle = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(handle)) return false;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", handle))
      .unique();
    return existing === null;
  },
});

/**
 * People you may know: members of communities you're in, minus yourself,
 * existing friends, pending requests in either direction, and anyone you've
 * blocked (or who blocked you). Powers the Suggested friends tab.
 * Online members sort first.
 */
export const suggest = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);

    const myMemberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .collect();
    const perServer = await Promise.all(
      myMemberships
        .slice(0, 20)
        .map((row) =>
          ctx.db
            .query("serverMembers")
            .withIndex("by_server", (q) => q.eq("serverId", row.serverId))
            .collect(),
        ),
    );
    const candidateIds = new Set<string>();
    for (const rows of perServer) {
      for (const row of rows) {
        if (row.userId !== id) candidateIds.add(row.userId);
      }
    }

    const [outgoing, incoming, blocking, blockedBy] = await Promise.all([
      ctx.db
        .query("connections")
        .withIndex("by_requester", (q) => q.eq("requesterId", id))
        .collect(),
      ctx.db
        .query("connections")
        .withIndex("by_addressee", (q) => q.eq("addresseeId", id))
        .collect(),
      ctx.db
        .query("blocks")
        .withIndex("by_blocker", (q) => q.eq("blockerId", id))
        .collect(),
      ctx.db
        .query("blocks")
        .withIndex("by_blocked", (q) => q.eq("blockedId", id))
        .collect(),
    ]);
    const exclude = new Set<string>([
      ...outgoing.map((row) => row.addresseeId as string),
      ...incoming.map((row) => row.requesterId as string),
      ...blocking.map((row) => row.blockedId as string),
      ...blockedBy.map((row) => row.blockerId as string),
    ]);
    for (const blocked of exclude) candidateIds.delete(blocked);

    const users = await hydrateUsers(
      ctx,
      [...candidateIds].slice(0, 80) as Id<"users">[],
      id,
    );
    return [...users.values()]
      .slice(0, 60)
      .sort((a, b) => {
        const aOnline = a.presence !== "offline" ? 0 : 1;
        const bOnline = b.presence !== "offline" ? 0 : 1;
        if (aOnline !== bOnline) return aOnline - bOnline;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  },
});
