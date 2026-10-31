/**
 * Permission bits used by communities (servers) in Kyro.
 *
 * This module is shared by the Convex backend (enforcement) and the React
 * frontend (affordances). The backend is always the source of truth: the UI
 * merely hides actions a member cannot perform.
 */

export const PERMISSIONS = {
  ADMINISTRATOR: "administrator",
  MANAGE_SERVER: "manage_server",
  MANAGE_CHANNELS: "manage_channels",
  MANAGE_ROLES: "manage_roles",
  MANAGE_MESSAGES: "manage_messages",
  KICK_MEMBERS: "kick_members",
  BAN_MEMBERS: "ban_members",
  CREATE_INVITES: "create_invites",
  SEND_MESSAGES: "send_messages",
  VIEW_AUDIT_LOG: "view_audit_log",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** What the default @everyone role starts with on a new community. */
export const DEFAULT_EVERYONE_PERMISSIONS: Permission[] = [
  PERMISSIONS.CREATE_INVITES,
  PERMISSIONS.SEND_MESSAGES,
];

/** Permissions granted to the community owner regardless of roles. */
export const OWNER_PERMISSIONS: Permission[] = ALL_PERMISSIONS;

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: Permission,
): boolean {
  if (!permissions) return false;
  return (
    permissions.includes(PERMISSIONS.ADMINISTRATOR) ||
    permissions.includes(permission)
  );
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  wanted: Permission[],
): boolean {
  return wanted.some((permission) => hasPermission(permissions, permission));
}

/**
 * Community staff may only delegate powers they already hold. Administrator
 * itself remains owner-only because it bypasses every individual check.
 */
export function canDelegatePermissions(
  granterPermissions: readonly string[] | undefined,
  requestedPermissions: readonly string[],
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  if (requestedPermissions.includes(PERMISSIONS.ADMINISTRATOR)) return false;
  return requestedPermissions.every((permission) =>
    hasPermission(granterPermissions, permission as Permission),
  );
}

export const PERMISSION_META: Record<
  Permission,
  { label: string; description: string }
> = {
  administrator: {
    label: "Administrator",
    description: "Grants every permission in this community.",
  },
  manage_server: {
    label: "Manage community",
    description: "Edit the name, icon, description and rules.",
  },
  manage_channels: {
    label: "Manage channels",
    description: "Create, rename, reorder and delete channels.",
  },
  manage_roles: {
    label: "Manage roles",
    description: "Create roles and change who has which permissions.",
  },
  manage_messages: {
    label: "Manage messages",
    description: "Delete other people's messages and slow a channel down.",
  },
  kick_members: {
    label: "Kick members",
    description: "Remove a member from this community.",
  },
  ban_members: {
    label: "Ban members",
    description: "Block a member from rejoining this community.",
  },
  create_invites: {
    label: "Create invites",
    description: "Generate invite links for this community.",
  },
  send_messages: {
    label: "Send messages",
    description: "Post messages in text channels.",
  },
  view_audit_log: {
    label: "View audit log",
    description: "See who changed what inside this community.",
  },
};

/** Default roles shown when a new community is created. */
export const DEFAULT_ROLE_COLORS = [
  "#5865F2",
  "#67E8F9",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#A78BFA",
];

/**
 * Extracts `@usernames` from a message body so the server can resolve them
 * to real users and create targeted notifications.
 */
export function parseMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_]{2,32})/g) ?? [];
  const names = matches.map((match) => match.slice(1).toLowerCase());
  return Array.from(new Set(names));
}
