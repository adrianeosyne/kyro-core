import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { parseMentions, PERMISSIONS } from "../lib/permissions";
import {
  can,
  canSendDirectMessage,
  getUserByUsername,
  hydrateUsers,
  logAudit,
  markRead,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_MESSAGE_LENGTH,
  notify,
  requireProfile,
  requireServerAccess,
  requireUser,
  type Ctx,
} from "./lib";

export type ContainerType = "channel" | "conversation";

const SENDER_COOLDOWN_MS = 5_000;
const DEFAULT_RATE_WINDOW_MESSAGES = 5;

type ReadAccess =
  | {
      kind: "channel";
      channel: Doc<"channels">;
      server: Doc<"servers">;
      member: Doc<"serverMembers">;
      permissions: string[];
    }
  | { kind: "conversation"; conversation: Doc<"conversations"> };

/** Read access to a channel or conversation, or a thrown error. */
async function requireReadAccess(
  ctx: Ctx,
  userId: Id<"users">,
  containerType: ContainerType,
  containerId: string,
): Promise<ReadAccess> {
  if (containerType === "channel") {
    const channel = await ctx.db.get(containerId as Id<"channels">);
    if (!channel) throw new Error("That channel no longer exists.");
    const access = await requireServerAccess(ctx, channel.serverId, userId);
    return {
      kind: "channel",
      channel,
      server: access.server,
      member: access.member,
      permissions: access.permissions,
    };
  }
  const conversation = await ctx.db.get(containerId as Id<"conversations">);
  if (!conversation) throw new Error("That conversation no longer exists.");
  if (!conversation.participantIds.includes(userId)) {
    throw new Error("You are not part of that conversation.");
  }
  return { kind: "conversation", conversation };
}

function containerLink(
  containerType: ContainerType,
  containerId: string,
  serverId?: string,
) {
  return containerType === "channel"
    ? `/dashboard/s/${serverId}/c/${containerId}`
    : `/dashboard/dm/${containerId}`;
}

export const list = query({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { containerType, containerId, before, limit }) => {
    const { id: viewerId } = await requireUser(ctx);
    await requireReadAccess(ctx, viewerId, containerType, containerId);

    const take = Math.min(limit ?? 50, 100);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_container", (q) =>
        before !== undefined
          ? q.eq("containerId", containerId).lt("createdAt", before)
          : q.eq("containerId", containerId),
      )
      .order("desc")
      .take(take + 1);

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const authors = await hydrateUsers(
      ctx,
      page.map((message) => message.authorId),
      viewerId,
    );

    const replyIds = Array.from(
      new Set(
        page
          .map((message) => message.replyToId)
          .filter((id): id is Id<"messages"> => Boolean(id)),
      ),
    );
    const replyDocs = await Promise.all(replyIds.map((id) => ctx.db.get(id)));
    const replyMap = new Map<string, Doc<"messages">>();
    replyDocs.forEach((doc, index) => {
      if (doc) replyMap.set(replyIds[index], doc);
    });
    const replyAuthors = await hydrateUsers(
      ctx,
      replyDocs
        .filter((doc): doc is Doc<"messages"> => Boolean(doc))
        .map((doc) => doc.authorId),
      viewerId,
    );

    const hydrated = await Promise.all(
      page.map(async (message) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();
        const grouped = new Map<string, string[]>();
        for (const reaction of reactions) {
          const list = grouped.get(reaction.emoji) ?? [];
          list.push(reaction.userId);
          grouped.set(reaction.emoji, list);
        }
        const attachments = await Promise.all(
          (message.attachments ?? []).map(async (attachment) => ({
            ...attachment,
            url: await ctx.storage.getUrl(attachment.storageId),
          })),
        );
        const reply = message.replyToId
          ? (replyMap.get(message.replyToId) ?? null)
          : null;
        return {
          id: message._id,
          content: message.content,
          createdAt: message.createdAt,
          editedAt: message.editedAt ?? null,
          clientId: message.clientId ?? null,
          author: authors.get(message.authorId) ?? null,
          authorId: message.authorId as string,
          attachments,
          reactions: Array.from(grouped.entries()).map(([emoji, userIds]) => ({
            emoji,
            userIds,
            count: userIds.length,
            mine: userIds.includes(viewerId),
          })),
          replyTo: reply
            ? {
                id: reply._id,
                excerpt: reply.content.slice(0, 160),
                author: replyAuthors.get(reply.authorId) ?? null,
              }
            : null,
        };
      }),
    );

    const read = await ctx.db
      .query("reads")
      .withIndex("by_user_key", (q) => q.eq("userId", viewerId).eq("key", containerId))
      .unique();

    return {
      messages: hydrated.reverse(),
      hasMore,
      oldest: page.length > 0 ? page[page.length - 1].createdAt : null,
      lastReadAt: read?.lastReadAt ?? 0,
    };
  },
});

export const send = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
    content: v.string(),
    clientId: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
          mimeType: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { id: userId, user } = await requireProfile(ctx);
    const content = args.content.trim();
    const attachments = args.attachments ?? [];
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
    }
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new Error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    }
    if (!content && attachments.length === 0) {
      throw new Error("Write something or attach a file.");
    }

    // Idempotency: retried sends with the same client id return the first row.
    if (args.clientId) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_container_client", (q) =>
          q.eq("containerId", args.containerId).eq("clientId", args.clientId!),
        )
        .unique();
      if (existing) return { messageId: existing._id, deduped: true };
    }

    for (const attachment of attachments) {
      if (attachment.size > MAX_ATTACHMENT_BYTES) {
        throw new Error("That file is larger than the 10 MB upload limit.");
      }
      const exists = await ctx.storage.getUrl(attachment.storageId);
      if (!exists) throw new Error("One of those files failed to upload.");
    }

    const access = await requireReadAccess(
      ctx,
      userId,
      args.containerType,
      args.containerId,
    );

    let permissions: string[] = [];
    let mutedServer = false;
    let serverId: Id<"servers"> | undefined;
    let dmConversation: Doc<"conversations"> | null = null;
    if (access.kind === "channel") {
      permissions = access.permissions;
      serverId = access.server._id;
      mutedServer = access.member.muted === true;
      const channel = access.channel;

      if (channel.readOnly && !can(permissions, PERMISSIONS.MANAGE_MESSAGES)) {
        throw new Error("This channel is read-only.");
      }
      if (access.server.locked === true && !can(permissions, PERMISSIONS.MANAGE_MESSAGES)) {
        throw new Error(
          "This community is locked — only staff can post right now.",
        );
      }
      if (!can(permissions, PERMISSIONS.SEND_MESSAGES)) {
        throw new Error("You don't have permission to send messages here.");
      }
      if (channel.slowMode && channel.slowMode > 0) {
        const recent = await ctx.db
          .query("messages")
          .withIndex("by_container", (q) => q.eq("containerId", args.containerId))
          .order("desc")
          .take(30);
        const mine = recent.find((message) => message.authorId === userId);
        if (mine) {
          const waitMs = channel.slowMode * 1000 - (Date.now() - mine.createdAt);
          if (waitMs > 0) {
            throw new Error(
              `Slow mode is on — wait ${Math.ceil(waitMs / 1000)}s before posting again.`,
            );
          }
        }
      }
    } else {
      dmConversation = access.conversation;
      if (dmConversation.type === "dm" && dmConversation.participantIds.length === 2) {
        const other = dmConversation.participantIds.find((id) => id !== userId)!;
        const check = await canSendDirectMessage(ctx, userId, other);
        if (!check.ok) throw new Error(check.reason);
      }
    }

    // Cheap abuse guard: at most 5 posts per 5 seconds per account.
    const recentMine = await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .take(DEFAULT_RATE_WINDOW_MESSAGES);
    const windowStart = Date.now() - SENDER_COOLDOWN_MS;
    // Only rate-limit once the window is actually full. `every()` on an empty
    // (or short) history is true, which would reject an account's first post.
    if (
      recentMine.length >= DEFAULT_RATE_WINDOW_MESSAGES &&
      recentMine.every((message) => message.createdAt > windowStart)
    ) {
      throw new Error("You're sending messages too quickly. Take a breath.");
    }

    const messageId = await ctx.db.insert("messages", {
      containerType: args.containerType,
      containerId: args.containerId,
      authorId: userId,
      content,
      createdAt: Date.now(),
      replyToId: args.replyToId,
      clientId: args.clientId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (args.containerType === "channel") {
      await ctx.db.patch(args.containerId as Id<"channels">, {
        lastMessageAt: Date.now(),
        lastMessageSenderId: userId,
      });
    } else {
      await ctx.db.patch(args.containerId as Id<"conversations">, {
        lastMessageAt: Date.now(),
        lastMessagePreview: content.slice(0, 140),
        lastMessageSenderId: userId,
        updatedAt: Date.now(),
      });
    }
    await markRead(ctx, userId, args.containerId);

    // Mentions and replies notify real people, never the sender.
    const mentionedNames = new Set(parseMentions(content));
    const notified = new Set<string>();
    const link = containerLink(args.containerType, args.containerId, serverId);

    if (args.containerType === "channel") {
      for (const username of mentionedNames) {
        const target = await getUserByUsername(ctx, username);
        if (!target || notified.has(target._id)) continue;
        const membership = await ctx.db
          .query("serverMembers")
          .withIndex("by_server_user", (q) =>
            q.eq("serverId", serverId!).eq("userId", target._id),
          )
          .unique();
        if (!membership) continue;
        if (membership.muted) continue;
        notified.add(target._id);
        await notify(ctx, {
          userId: target._id,
          type: "mention",
          title: `${user.name ?? user.username} mentioned you`,
          body: content.slice(0, 160),
          actorId: userId,
          link,
          containerKey: args.containerId,
        });
      }
    } else if (dmConversation) {
      for (const participantId of dmConversation.participantIds) {
        const target = await ctx.db.get(participantId);
        if (!target || !target.username) continue;
        if (!mentionedNames.has(target.username.toLowerCase())) continue;
        if (notified.has(target._id)) continue;
        notified.add(target._id);
        await notify(ctx, {
          userId: target._id,
          type: "mention",
          title: `${user.name ?? user.username} mentioned you`,
          body: content.slice(0, 160),
          actorId: userId,
          link,
          containerKey: args.containerId,
        });
      }
    }

    if (args.replyToId) {
      const replyTarget = await ctx.db.get(args.replyToId);
      if (
        replyTarget &&
        replyTarget.containerId === args.containerId &&
        !notified.has(replyTarget.authorId)
      ) {
        const target = await ctx.db.get(replyTarget.authorId);
        const allowed =
          access.kind === "channel" ||
          (target !== null &&
            dmConversation !== null &&
            dmConversation.participantIds.includes(replyTarget.authorId));
        if (allowed && !mutedServer) {
          await notify(ctx, {
            userId: replyTarget.authorId,
            type: "reply",
            title: `${user.name ?? user.username} replied to you`,
            body: content.slice(0, 160),
            actorId: userId,
            link,
            containerKey: args.containerId,
          });
        }
      }
    }

    return { messageId, deduped: false };
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    const { id: userId } = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("That message no longer exists.");
    if (message.authorId !== userId) {
      throw new Error("You can only edit your own messages.");
    }
    const trimmed = content.trim();
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
    }
    if (!trimmed) throw new Error("A message can't be empty.");
    await ctx.db.patch(messageId, { content: trimmed, editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const { id: userId } = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) return;
    if (message.authorId !== userId) {
      if (message.containerType !== "channel") {
        throw new Error("You can only delete your own messages.");
      }
      const channel = await ctx.db.get(message.containerId as Id<"channels">);
      if (!channel) throw new Error("That channel no longer exists.");
      const access = await requireServerAccess(ctx, channel.serverId, userId);
      if (!can(access.permissions, PERMISSIONS.MANAGE_MESSAGES)) {
        throw new Error("You need Manage Messages to delete other people's posts.");
      }
      await logAudit(ctx, {
        serverId: channel.serverId,
        actorId: userId,
        action: "message.delete",
        targetType: "message",
        targetId: message._id,
        details: `Deleted a message in #${channel.name}`,
      });
    }
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect();
    for (const reaction of reactions) await ctx.db.delete(reaction._id);
    await ctx.db.delete(messageId);
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const { id: userId } = await requireUser(ctx);
    const normalized = emoji.trim();
    if (!normalized || normalized.length > 32) {
      throw new Error("That reaction isn't valid.");
    }
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("That message no longer exists.");
    await requireReadAccess(
      ctx,
      userId,
      message.containerType,
      message.containerId,
    );
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", messageId).eq("userId", userId),
      )
      .collect();
    const mine = existing.find((reaction) => reaction.emoji === normalized);
    if (mine) {
      await ctx.db.delete(mine._id);
      return { active: false };
    }
    await ctx.db.insert("reactions", {
      messageId,
      userId,
      emoji: normalized,
      createdAt: Date.now(),
    });
    return { active: true };
  },
});

export const markContainerRead = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id: userId } = await requireUser(ctx);
    await requireReadAccess(ctx, userId, containerType, containerId);
    await markRead(ctx, userId, containerId);
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();
    for (const note of notes) {
      if (note.containerKey === containerId) await ctx.db.patch(note._id, { read: true });
    }
  },
});

/** Marks every channel in a server as read (right-click a server → Mark as read). */
export const markServerRead = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id: userId } = await requireUser(ctx);
    await requireServerAccess(ctx, serverId, userId);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    for (const channel of channels) {
      await markRead(ctx, userId, channel._id);
    }
    const channelIds = new Set(channels.map((channel) => channel._id as string));
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();
    for (const note of notes) {
      if (note.containerKey && channelIds.has(note.containerKey)) {
        await ctx.db.patch(note._id, { read: true });
      }
    }
  },
});

/** Records that the user is typing; expires after a few seconds. */
export const setTyping = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id: userId } = await requireUser(ctx);
    await requireReadAccess(ctx, userId, containerType, containerId);
    const now = Date.now();
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_key", (q) => q.eq("key", containerId))
      .collect();
    for (const row of rows) {
      if (row.expiresAt < now || row.userId === userId) await ctx.db.delete(row._id);
    }
    await ctx.db.insert("typing", {
      key: containerId,
      userId,
      expiresAt: now + 6_000,
    });
  },
});

export const typingList = query({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id: userId } = await requireUser(ctx);
    await requireReadAccess(ctx, userId, containerType, containerId);
    const now = Date.now();
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_key", (q) => q.eq("key", containerId))
      .collect();
    const users = await hydrateUsers(
      ctx,
      rows.filter((row) => row.expiresAt > now).map((row) => row.userId),
      userId,
    );
    return rows
      .filter((row) => row.expiresAt > now && row.userId !== userId)
      .map((row) => users.get(row.userId))
      .filter((user): user is NonNullable<typeof user> => Boolean(user));
  },
});
