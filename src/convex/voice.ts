import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { hydrateUsers, requireUser, type Ctx } from "./lib";

/**
 * Live audio for Kyro: voice channels in communities and voice calls in DMs.
 *
 * There is no media server — peers connect to each other directly over WebRTC
 * and use Convex purely as the presence roster and the signaling relay
 * (offers, answers and ICE candidates), which is plenty for rooms of this
 * size. A session row doubles as the liveness heartbeat.
 */

/** Sessions that haven't been touched in this long are considered gone. */
const SESSION_TTL_MS = 45_000;

export type VoiceContainerType = "channel" | "conversation";

async function activeSessions(
  ctx: Ctx,
  containerType: VoiceContainerType,
  containerId: string,
): Promise<Doc<"voiceSessions">[]> {
  const rows = await ctx.db
    .query("voiceSessions")
    .withIndex("by_container", (q) =>
      q.eq("containerType", containerType).eq("containerId", containerId),
    )
    .collect();
  const cutoff = Date.now() - SESSION_TTL_MS;
  return rows.filter((row) => row.lastSeenAt > cutoff);
}

/** Join (or refresh) this account's seat in a voice room. */
export const join = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
    muted: v.optional(v.boolean()),
    deafened: v.optional(v.boolean()),
  },
  handler: async (ctx, { containerType, containerId, muted, deafened }) => {
    const { id } = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .collect();
    const mine = existing.find(
      (row) =>
        row.containerType === containerType && row.containerId === containerId,
    );
    if (mine) {
      await ctx.db.patch(mine._id, {
        lastSeenAt: now,
        ...(muted !== undefined ? { muted } : {}),
        ...(deafened !== undefined ? { deafened } : {}),
      });
      return;
    }
    // One seat per account: leaving a previous room is implied by joining here.
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("voiceSessions", {
      containerType,
      containerId,
      userId: id,
      joinedAt: now,
      lastSeenAt: now,
      muted: muted ?? false,
      deafened: deafened ?? false,
    });
  },
});

/** Drop this account's seat — called on hang-up and on page unload. */
export const leave = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id } = await requireUser(ctx);
    const rows = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .collect();
    for (const row of rows) {
      if (row.containerType === containerType && row.containerId === containerId) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/** Who is in the room right now, hydrated for the roster UI. */
export const roster = query({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id } = await requireUser(ctx);
    const sessions = await activeSessions(ctx, containerType, containerId);
    const users = await hydrateUsers(
      ctx,
      sessions.map((session) => session.userId),
      id,
    );
    return sessions.map((session) => ({
      userId: session.userId as string,
      muted: session.muted === true,
      deafened: session.deafened === true,
      joinedAt: session.joinedAt,
      user: users.get(session.userId) ?? null,
    }));
  },
});

/**
 * Signaling relay: everyone in the room can see messages addressed to them.
 * Rows are cleaned up as they're read so the table never grows unbounded.
 */
export const signals = query({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
  },
  handler: async (ctx, { containerType, containerId }) => {
    const { id } = await requireUser(ctx);
    const key = `${containerType}:${containerId}`;
    const rows = await ctx.db
      .query("voiceSignals")
      .withIndex("by_to_container", (q) =>
        q.eq("toId", id).eq("containerKey", key),
      )
      .collect();
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((row) => ({
        id: row._id as string,
        fromId: row.fromId as string,
        kind: row.kind,
        payload: row.payload,
        createdAt: row.createdAt,
      }));
  },
});

export const signal = mutation({
  args: {
    containerType: v.union(v.literal("channel"), v.literal("conversation")),
    containerId: v.string(),
    toId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    if (args.toId === id) return;
    if (args.payload.length > 100_000) return;
    await ctx.db.insert("voiceSignals", {
      containerKey: `${args.containerType}:${args.containerId}`,
      fromId: id,
      toId: args.toId,
      kind: args.kind,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

/** Called by the client once a signal has been handled. */
export const ackSignal = mutation({
  args: { signalId: v.id("voiceSignals") },
  handler: async (ctx, { signalId }) => {
    const { id } = await requireUser(ctx);
    const row = await ctx.db.get(signalId);
    if (row && row.toId === id) await ctx.db.delete(signalId);
  },
});

/* ------------------------------------------------------------------ */
/* DM calls                                                            */
/* ------------------------------------------------------------------ */

/** Ring everyone in the conversation. Returns the call id. */
export const startCall = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const { id } = await requireUser(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("That conversation no longer exists.");
    if (!conversation.participantIds.includes(id)) {
      throw new Error("You're not part of this conversation.");
    }
    const open = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .first();
    const now = Date.now();
    if (open && !open.endedAt && now - open.startedAt < 5 * 60_000) {
      return open._id;
    }
    return await ctx.db.insert("calls", {
      conversationId,
      callerId: id,
      calleeIds: conversation.participantIds.filter((userId) => userId !== id),
      startedAt: now,
    });
  },
});

export const answerCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { id } = await requireUser(ctx);
    const call = await ctx.db.get(callId);
    if (!call) throw new Error("That call is over.");
    if (!call.calleeIds.includes(id)) throw new Error("You're not being called.");
    await ctx.db.patch(callId, { answeredAt: call.answeredAt ?? Date.now() });
  },
});

/** Hang up. An unanswered call becomes a missed call. */
export const endCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { id } = await requireUser(ctx);
    const call = await ctx.db.get(callId);
    if (!call || call.endedAt) return;
    const now = Date.now();
    const missed = !call.answeredAt && call.callerId === id;
    await ctx.db.patch(callId, { endedAt: now, missed });

    // Leave a record in the conversation: a missed call that nobody picked up,
    // or the length of the call that happened. Both render in chat and in the
    // conversation list preview.
    const durationMs = call.answeredAt ? now - call.answeredAt : 0;
    const preview = missed
      ? "Missed call"
      : durationMs >= 60_000
        ? `Voice call · ${Math.floor(durationMs / 60_000)}m`
        : "Voice call";
    await ctx.db.insert("messages", {
      containerType: "conversation",
      containerId: call.conversationId as unknown as string,
      authorId: call.callerId,
      content: preview,
      kind: missed ? "call_missed" : "call_ended",
      ...(durationMs > 0 ? { callDurationMs: durationMs } : {}),
      createdAt: now,
    });
    // Keep the conversation's unread preview in sync with this new message.
    await ctx.db.patch(call.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageSenderId: call.callerId,
      updatedAt: now,
    });
  },
});

/** The call this account most recently started in a conversation. */
export const currentCall = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const { id } = await requireUser(ctx);
    const call = await ctx.db
      .query("calls")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .first();
    if (!call) return null;
    const now = Date.now();
    if (call.endedAt) return null;
    if (now - call.startedAt > 5 * 60_000) {
      // Abandoned without hanging up — treat it as missed from here on.
      return null;
    }
    return {
      id: call._id as string,
      callerId: call.callerId as string,
      isCaller: call.callerId === id,
      startedAt: call.startedAt,
      answeredAt: call.answeredAt ?? null,
    };
  },
});
