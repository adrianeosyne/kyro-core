import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { PERMISSIONS } from "../lib/permissions";
import {
  can,
  hydrateUsers,
  notify,
  requireProfile,
  requireServerAccess,
  requireUser,
} from "./lib";

export const create = mutation({
  args: {
    reportedUserId: v.optional(v.id("users")),
    messageId: v.optional(v.id("messages")),
    serverId: v.optional(v.id("servers")),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    if (!args.reportedUserId && !args.messageId) {
      throw new Error("Choose something to report.");
    }
    const cleanReason = args.reason.trim().slice(0, 120);
    if (cleanReason.length < 3) {
      throw new Error("Tell us a bit more about the problem.");
    }

    // Derive the community so its moderators actually see the report.
    let serverId = args.serverId;
    if (!serverId && args.messageId) {
      const message = await ctx.db.get(args.messageId);
      if (message?.containerType === "channel") {
        const channel = await ctx.db.get(message.containerId as Id<"channels">);
        serverId = channel?.serverId;
      }
    }

    const reportId = await ctx.db.insert("reports", {
      reporterId: id,
      reportedUserId: args.reportedUserId,
      messageId: args.messageId,
      serverId,
      reason: cleanReason,
      details: args.details?.trim().slice(0, 1000),
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (serverId) {
      const server = await ctx.db.get(serverId);
      if (server) {
        await notify(ctx, {
          userId: server.ownerId,
          type: "moderation",
          title: `New report in ${server.name}`,
          body: cleanReason,
          link: `/dashboard/s/${serverId}/settings/moderation`,
        });
      }
    }
    return reportId;
  },
});

/** Reports a moderator (or site admin) is allowed to review. */
export const queue = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("reviewing"),
        v.literal("resolved"),
        v.literal("dismissed"),
      ),
    ),
  },
  handler: async (ctx, { status }) => {
    const { id, user } = await requireUser(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .collect();

    const moderatedServers = new Set<string>();
    for (const membership of memberships) {
      const access = await requireServerAccess(ctx, membership.serverId, id);
      if (
        access.server.ownerId === id ||
        can(access.permissions, PERMISSIONS.BAN_MEMBERS) ||
        can(access.permissions, PERMISSIONS.MANAGE_MESSAGES)
      ) {
        moderatedServers.add(membership.serverId);
      }
    }

    const reports = await (status
      ? ctx.db
          .query("reports")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(80)
      : ctx.db.query("reports").order("desc").take(80));

    const visible = reports.filter(
      (report) =>
        user.role === "admin" ||
        (report.serverId !== undefined &&
          moderatedServers.has(report.serverId)),
    );

    const users = await hydrateUsers(
      ctx,
      visible.flatMap((report) => [report.reporterId, report.reportedUserId]),
      id,
    );

    return visible.map((report) => ({
      id: report._id as string,
      reason: report.reason,
      details: report.details ?? null,
      status: report.status,
      createdAt: report.createdAt,
      reporter: users.get(report.reporterId) ?? null,
      reported: report.reportedUserId ? (users.get(report.reportedUserId) ?? null) : null,
      serverId: (report.serverId as string | null) ?? null,
    }));
  },
});

/** Reports this user filed, so they can see what happened to them. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", id))
      .order("desc")
      .take(30);
    return reports.map((report) => ({
      id: report._id as string,
      reason: report.reason,
      status: report.status,
      resolution: report.resolution ?? null,
      createdAt: report.createdAt,
    }));
  },
});

export const resolve = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("reviewing"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, { reportId, status, resolution }) => {
    const { id, user } = await requireUser(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("That report no longer exists.");
    let allowed = user.role === "admin";
    if (!allowed && report.serverId) {
      const access = await requireServerAccess(ctx, report.serverId, id);
      allowed =
        access.server.ownerId === id ||
        can(access.permissions, PERMISSIONS.BAN_MEMBERS) ||
        can(access.permissions, PERMISSIONS.MANAGE_MESSAGES);
    }
    if (!allowed) throw new Error("You can't review that report.");
    await ctx.db.patch(reportId, {
      status,
      resolution: resolution?.trim().slice(0, 500),
      updatedAt: Date.now(),
    });
    await notify(ctx, {
      userId: report.reporterId,
      type: "moderation",
      title: "Your report was reviewed",
      body: resolution?.slice(0, 200),
      actorId: id,
    });
  },
});
