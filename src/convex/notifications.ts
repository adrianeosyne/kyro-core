import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hydrateUsers, requireUser } from "./lib";

/** Notification inbox for the signed-in user. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const { id } = await requireUser(ctx);
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .take(Math.min(limit ?? 40, 100));
    const actors = await hydrateUsers(
      ctx,
      notes.map((note) => note.actorId),
      id,
    );
    return notes.map((note) => ({
      id: note._id as string,
      type: note.type,
      title: note.title,
      body: note.body ?? null,
      link: note.link ?? null,
      containerKey: note.containerKey ?? null,
      read: note.read,
      createdAt: note.createdAt,
      actor: note.actorId ? (actors.get(note.actorId) ?? null) : null,
    }));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    return (
      await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) => q.eq("userId", id).eq("read", false))
        .collect()
    ).length;
  },
});

export const markRead = mutation({
  args: { ids: v.array(v.id("notifications")) },
  handler: async (ctx, { ids }) => {
    const { id } = await requireUser(ctx);
    for (const noteId of ids.slice(0, 100)) {
      const note = await ctx.db.get(noteId);
      if (note && note.userId === id && !note.read) {
        await ctx.db.patch(noteId, { read: true });
      }
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", id).eq("read", false))
      .take(200);
    for (const note of notes) await ctx.db.patch(note._id, { read: true });
  },
});
