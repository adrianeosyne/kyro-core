import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { PERMISSIONS } from "../lib/permissions";
import {
  can,
  logAudit,
  requireProfile,
  requireServerAccess,
  requireUser,
} from "./lib";

const CHANNEL_NAME = /^[a-z0-9][a-z0-9-_]{0,99}$/i;

/** Sidebar payload: categories, channels, unread flags and my permissions. */
export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id } = await requireUser(ctx);
    const access = await requireServerAccess(ctx, serverId, id);
    const [categories, channels, reads] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_server_position", (q) => q.eq("serverId", serverId))
        .collect(),
      ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
      ctx.db
        .query("reads")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .collect(),
    ]);
    const readMap = new Map(reads.map((read) => [read.key, read.lastReadAt]));

    return {
      permissions: access.permissions,
      isOwner: access.server.ownerId === id,
      categories: categories
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((category) => ({
          id: category._id as string,
          name: category.name,
          position: category.position,
        })),
      channels: channels
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((channel) => ({
          id: channel._id as string,
          name: channel.name,
          topic: channel.topic ?? null,
          categoryId: (channel.categoryId as string | undefined) ?? null,
          position: channel.position,
          readOnly: channel.readOnly === true,
          kind: channel.kind === "voice" ? ("voice" as const) : ("text" as const),
          isRules: access.server.rulesChannelId === channel._id,
          slowMode: channel.slowMode ?? 0,
          lastMessageAt: channel.lastMessageAt ?? 0,
          lastMessageSenderId:
            (channel.lastMessageSenderId as string | undefined) ?? null,
          unread:
            (channel.lastMessageAt ?? 0) > (readMap.get(channel._id) ?? 0),
        })),
    };
  },
});

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    topic: v.optional(v.string()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    /** `voice` creates a live audio room instead of a text channel. */
    kind: v.optional(v.union(v.literal("text"), v.literal("voice"))),
  },
  handler: async (ctx, { serverId, name, topic, categoryId, kind }) => {
    const { id } = await requireProfile(ctx);
    const access = await requireServerAccess(ctx, serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to create channels.");
    }
    const clean = name.trim();
    if (!CHANNEL_NAME.test(clean)) {
      throw new Error(
        "Channel names use letters, numbers, dashes and underscores.",
      );
    }
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    if (existing.some((channel) => channel.name.toLowerCase() === clean.toLowerCase() && (!categoryId || channel.categoryId === categoryId))) {
      throw new Error("There's already a channel with that name.");
    }
    const siblings = existing.filter(
      (channel) =>
        (categoryId === undefined || categoryId === null
          ? !channel.categoryId
          : channel.categoryId === categoryId),
    );
    const channelId = await ctx.db.insert("channels", {
      serverId,
      categoryId: categoryId ?? undefined,
      name: clean,
      topic: topic?.trim().slice(0, 300) || undefined,
      kind: kind === "voice" ? "voice" : undefined,
      position: siblings.length,
      createdAt: Date.now(),
      createdById: id,
    });
    await logAudit(ctx, {
      serverId,
      actorId: id,
      action: "channel.create",
      targetType: "channel",
      targetId: channelId,
      details: `#${clean}`,
    });
    return channelId;
  },
});

export const update = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    topic: v.optional(v.string()),
    slowMode: v.optional(v.number()),
    readOnly: v.optional(v.boolean()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
  },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("That channel doesn't exist.");
    const access = await requireServerAccess(ctx, channel.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to edit channels.");
    }
    const patch: Partial<Doc<"channels">> = {};
    if (args.name !== undefined) {
      const clean = args.name.trim();
      if (!CHANNEL_NAME.test(clean)) {
        throw new Error(
          "Channel names use letters, numbers, dashes and underscores.",
        );
      }
      patch.name = clean;
    }
    if (args.topic !== undefined) patch.topic = args.topic.trim().slice(0, 300);
    if (args.slowMode !== undefined) {
      if (args.slowMode < 0 || args.slowMode > 21600) {
        throw new Error("Slow mode must be between 0 and 21600 seconds.");
      }
      patch.slowMode = Math.floor(args.slowMode);
    }
    if (args.readOnly !== undefined) patch.readOnly = args.readOnly;
    if (args.categoryId !== undefined) {
      patch.categoryId = args.categoryId ?? undefined;
    }
    await ctx.db.patch(args.channelId, patch);
    await logAudit(ctx, {
      serverId: channel.serverId,
      actorId: id,
      action: "channel.update",
      targetType: "channel",
      targetId: args.channelId,
      details: Object.keys(args)
        .filter((key) => key !== "channelId")
        .join(", "),
    });
  },
});

export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { id } = await requireProfile(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) return;
    const access = await requireServerAccess(ctx, channel.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to delete channels.");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_container", (q) => q.eq("containerId", channelId))
      .take(2000);
    for (const message of messages) {
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const reaction of reactions) await ctx.db.delete(reaction._id);
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(channelId);
    await logAudit(ctx, {
      serverId: channel.serverId,
      actorId: id,
      action: "channel.delete",
      targetType: "channel",
      targetId: channelId,
      details: `#${channel.name}`,
    });
  },
});

export const createCategory = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, { serverId, name }) => {
    const { id } = await requireProfile(ctx);
    const access = await requireServerAccess(ctx, serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to manage categories.");
    }
    const clean = name.trim().slice(0, 60);
    if (clean.length < 2) throw new Error("Category names need 2+ characters.");
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    const categoryId = await ctx.db.insert("categories", {
      serverId,
      name: clean,
      position: existing.length,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId,
      actorId: id,
      action: "category.create",
      targetType: "category",
      targetId: categoryId,
      details: clean,
    });
    return categoryId;
  },
});

export const updateCategory = mutation({
  args: { categoryId: v.id("categories"), name: v.string() },
  handler: async (ctx, { categoryId, name }) => {
    const { id } = await requireProfile(ctx);
    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error("That category doesn't exist.");
    const access = await requireServerAccess(ctx, category.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to manage categories.");
    }
    const clean = name.trim().slice(0, 60);
    if (clean.length < 2) throw new Error("Category names need 2+ characters.");
    await ctx.db.patch(categoryId, { name: clean });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const { id } = await requireProfile(ctx);
    const category = await ctx.db.get(categoryId);
    if (!category) return;
    const access = await requireServerAccess(ctx, category.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to manage categories.");
    }
    const children = await ctx.db
      .query("channels")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect();
    for (const child of children) await ctx.db.patch(child._id, { categoryId: undefined });
    await ctx.db.delete(categoryId);
    await logAudit(ctx, {
      serverId: category.serverId,
      actorId: id,
      action: "category.delete",
      targetType: "category",
      targetId: categoryId,
      details: category.name,
    });
  },
});

/** Drag-and-drop persistence for the channel sidebar. */
export const reorder = mutation({
  args: {
    serverId: v.id("servers"),
    categories: v.array(
      v.object({ id: v.id("categories"), position: v.number() }),
    ),
    channels: v.array(
      v.object({
        id: v.id("channels"),
        position: v.number(),
        categoryId: v.union(v.id("categories"), v.null()),
      }),
    ),
  },
  handler: async (ctx, { serverId, categories, channels }) => {
    const { id } = await requireProfile(ctx);
    const access = await requireServerAccess(ctx, serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_CHANNELS)) {
      throw new Error("You don't have permission to reorder channels.");
    }
    for (const entry of categories) {
      await ctx.db.patch(entry.id, { position: entry.position });
    }
    for (const entry of channels) {
      await ctx.db.patch(entry.id, {
        position: entry.position,
        categoryId: entry.categoryId ?? undefined,
      });
    }
    await logAudit(ctx, {
      serverId,
      actorId: id,
      action: "channel.reorder",
      details: `${channels.length} channels reorganised`,
    });
  },
});
