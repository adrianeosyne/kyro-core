import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ALL_PERMISSIONS, PERMISSIONS } from "../lib/permissions";
import {
  can,
  logAudit,
  requireProfile,
  requireServerAccess,
  requireUser,
  type Ctx,
  type ServerAccess,
} from "./lib";
import type { Doc } from "./_generated/dataModel";

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id } = await requireUser(ctx);
    await requireServerAccess(ctx, serverId, id);
    const roles = await ctx.db
      .query("serverRoles")
      .withIndex("by_server_position", (q) => q.eq("serverId", serverId))
      .collect();
    return roles.map((role) => ({
      id: role._id as string,
      name: role.name,
      color: role.color ?? null,
      position: role.position,
      isDefault: role.isDefault,
      permissions: role.permissions,
    }));
  },
});

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    color: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { serverId, name, color, permissions }) => {
    const { id } = await requireProfile(ctx);
    const access = await requireServerAccess(ctx, serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_ROLES)) {
      throw new Error("You don't have permission to manage roles.");
    }
    const clean = name.trim().slice(0, 60);
    if (clean.length < 2) throw new Error("Role names need 2+ characters.");
    const existing = await ctx.db
      .query("serverRoles")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    if (existing.some((role) => role.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error("A role with that name already exists.");
    }
    const myTop = await topPosition(ctx, access, existing);
    const requested = sanitizePermissions(permissions);
    if (requested.includes(PERMISSIONS.ADMINISTRATOR) && myTop < Number.MAX_SAFE_INTEGER) {
      throw new Error("You can't create an Administrator role.");
    }
    const position = Math.min(
      myTop + 1,
      existing.reduce((max, role) => Math.max(max, role.position), 0) + 1,
    );
    const roleId = await ctx.db.insert("serverRoles", {
      serverId,
      name: clean,
      color: color || undefined,
      position,
      permissions: requested,
      isDefault: false,
    });
    await logAudit(ctx, {
      serverId,
      actorId: id,
      action: "role.create",
      targetType: "role",
      targetId: roleId,
      details: clean,
    });
    return roleId;
  },
});

export const update = mutation({
  args: {
    roleId: v.id("serverRoles"),
    name: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("That role doesn't exist.");
    const access = await requireServerAccess(ctx, role.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_ROLES)) {
      throw new Error("You don't have permission to manage roles.");
    }
    const roles = await ctx.db
      .query("serverRoles")
      .withIndex("by_server", (q) => q.eq("serverId", role.serverId))
      .collect();
    const myTop = await topPosition(ctx, access, roles);
    if (!role.isDefault && role.position > myTop && access.server.ownerId !== id) {
      throw new Error("You can't edit a role above your own.");
    }
    const patch: Partial<typeof role> = {};
    if (args.name !== undefined) {
      const clean = args.name.trim().slice(0, 60);
      if (clean.length < 2) throw new Error("Role names need 2+ characters.");
      patch.name = clean;
    }
    if (args.color !== undefined) {
      if (args.color && !/^#[0-9a-fA-F]{6}$/.test(args.color)) {
        throw new Error("Colour must look like #67E8F9.");
      }
      patch.color = args.color || undefined;
    }
    if (args.permissions !== undefined) {
      const requested = sanitizePermissions(args.permissions);
      if (
        requested.includes(PERMISSIONS.ADMINISTRATOR) &&
        myTop < Number.MAX_SAFE_INTEGER
      ) {
        throw new Error("Only the owner can grant Administrator.");
      }
      patch.permissions = requested;
    }
    await ctx.db.patch(args.roleId, patch);
    await logAudit(ctx, {
      serverId: role.serverId,
      actorId: id,
      action: "role.update",
      targetType: "role",
      targetId: args.roleId,
      details: Object.keys(args)
        .filter((key) => key !== "roleId")
        .join(", "),
    });
  },
});

export const remove = mutation({
  args: { roleId: v.id("serverRoles") },
  handler: async (ctx, { roleId }) => {
    const { id } = await requireProfile(ctx);
    const role = await ctx.db.get(roleId);
    if (!role) return;
    const access = await requireServerAccess(ctx, role.serverId, id);
    if (!can(access.permissions, PERMISSIONS.MANAGE_ROLES)) {
      throw new Error("You don't have permission to manage roles.");
    }
    if (role.isDefault) throw new Error("The @everyone role can't be deleted.");
    const roles = await ctx.db
      .query("serverRoles")
      .withIndex("by_server", (q) => q.eq("serverId", role.serverId))
      .collect();
    const myTop = await topPosition(ctx, access, roles);
    if (role.position > myTop && access.server.ownerId !== id) {
      throw new Error("You can't delete a role above your own.");
    }
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", role.serverId))
      .collect();
    for (const member of members) {
      if (member.roleIds.includes(roleId)) {
        await ctx.db.patch(member._id, {
          roleIds: member.roleIds.filter((existing) => existing !== roleId),
        });
      }
    }
    await ctx.db.delete(roleId);
    await logAudit(ctx, {
      serverId: role.serverId,
      actorId: id,
      action: "role.delete",
      targetType: "role",
      targetId: roleId,
      details: role.name,
    });
  },
});

function sanitizePermissions(permissions: string[]): string[] {
  const valid = new Set<string>(ALL_PERMISSIONS);
  return Array.from(new Set(permissions)).filter((permission) =>
    valid.has(permission),
  );
}

async function topPosition(
  ctx: Ctx,
  access: ServerAccess,
  roles: Doc<"serverRoles">[],
): Promise<number> {
  if (access.server.ownerId === access.member.userId) return Number.MAX_SAFE_INTEGER;
  const assigned = roles.filter((role) => access.member.roleIds.includes(role._id));
  return assigned.length > 0
    ? Math.max(...assigned.map((role) => role.position))
    : 0;
}
