import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const presenceValidator = v.union(
  v.literal("online"),
  v.literal("idle"),
  v.literal("dnd"),
  v.literal("invisible"),
  v.literal("offline"),
);
export type Presence = Infer<typeof presenceValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user is anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // --- Kyro profile + presence ---
      /** Unique, lowercased handle used for @mentions and friend search. */
      username: v.optional(v.string()),
      bio: v.optional(v.string()),
      /** Storage id of an uploaded avatar (resolved to a signed URL on read). */
      avatarStorageId: v.optional(v.id("_storage")),
      /** Chosen status. `invisible` renders as offline to everybody else. */
      status: v.optional(presenceValidator),
      customStatus: v.optional(v.string()),
      /** Heartbeat timestamp; drives "online" for clients that never set a status. */
      lastSeen: v.optional(v.number()),
      /** Per-user accent colour used across their own interface. */
      accent: v.optional(v.string()),
      /** Privacy controls, enforced server-side. */
      dmPolicy: v.optional(
        v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody")),
      ),
      allowFriendRequests: v.optional(v.boolean()),
      showPresence: v.optional(v.boolean()),
      createdAt: v.optional(v.number()),
      /** Username changes are limited to once every 30 days. */
      usernameChangedAt: v.optional(v.number()),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_username", ["username"]),

    /** Friend requests in either direction; `accepted` rows are friendships. */
    connections: defineTable({
      requesterId: v.id("users"),
      addresseeId: v.id("users"),
      status: v.union(v.literal("pending"), v.literal("accepted")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_requester", ["requesterId", "status"])
      .index("by_addressee", ["addresseeId", "status"])
      .index("by_requester_addressee", ["requesterId", "addresseeId"]),

    /** Blocking is enforced on the server: no DMs, no friend requests. */
    blocks: defineTable({
      blockerId: v.id("users"),
      blockedId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_blocker", ["blockerId"])
      .index("by_blocked", ["blockedId"])
      .index("by_pair", ["blockerId", "blockedId"]),

    /** Direct messages: exactly two participants for `dm`, 3+ for `group`. */
    conversations: defineTable({
      type: v.union(v.literal("dm"), v.literal("group")),
      participantIds: v.array(v.id("users")),
      /** Sorted "a:b" key so a 1:1 conversation can never be duplicated. */
      pairKey: v.optional(v.string()),
      name: v.optional(v.string()),
      ownerId: v.optional(v.id("users")),
      lastMessageAt: v.optional(v.number()),
      lastMessagePreview: v.optional(v.string()),
      lastMessageSenderId: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index("by_pair", ["pairKey"])
      .index("by_last", ["lastMessageAt"]),

    /** Membership rows so "my conversations" is a real indexed lookup. */
    conversationMembers: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      joinedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_conversation", ["conversationId"])
      .index("by_user_conversation", ["userId", "conversationId"]),

    servers: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      iconStorageId: v.optional(v.id("_storage")),
      bannerStorageId: v.optional(v.id("_storage")),
      ownerId: v.id("users"),
      isPublic: v.boolean(),
      rules: v.optional(v.string()),
      welcomeMessage: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index("by_owner", ["ownerId"])
      .index("by_created", ["createdAt"])
      .searchIndex("search_name", {
        searchField: "name",
        filterFields: ["isPublic"],
      }),

    serverMembers: defineTable({
      serverId: v.id("servers"),
      userId: v.id("users"),
      nickname: v.optional(v.string()),
      roleIds: v.array(v.id("serverRoles")),
      joinedAt: v.number(),
      /** Mute every notification from this community. */
      muted: v.optional(v.boolean()),
    })
      .index("by_server", ["serverId"])
      .index("by_user", ["userId"])
      .index("by_server_user", ["serverId", "userId"]),

    serverRoles: defineTable({
      serverId: v.id("servers"),
      name: v.string(),
      color: v.optional(v.string()),
      position: v.number(),
      permissions: v.array(v.string()),
      isDefault: v.boolean(),
    })
      .index("by_server", ["serverId"])
      .index("by_server_position", ["serverId", "position"]),

    categories: defineTable({
      serverId: v.id("servers"),
      name: v.string(),
      position: v.number(),
      createdAt: v.number(),
    })
      .index("by_server", ["serverId"])
      .index("by_server_position", ["serverId", "position"]),

    channels: defineTable({
      serverId: v.id("servers"),
      categoryId: v.optional(v.id("categories")),
      name: v.string(),
      topic: v.optional(v.string()),
      position: v.number(),
      /** Seconds users must wait between messages. 0 disables slow mode. */
      slowMode: v.optional(v.number()),
      /** Read-only channel: only members with manage_messages may post. */
      readOnly: v.optional(v.boolean()),
      lastMessageAt: v.optional(v.number()),
      lastMessageSenderId: v.optional(v.id("users")),
      createdAt: v.number(),
      createdById: v.optional(v.id("users")),
    })
      .index("by_server", ["serverId"])
      .index("by_category", ["categoryId"])
      .index("by_server_position", ["serverId", "position"]),

    /** One row per message in a channel *or* a direct-message conversation. */
    messages: defineTable({
      containerType: v.union(v.literal("channel"), v.literal("conversation")),
      containerId: v.string(),
      authorId: v.id("users"),
      content: v.string(),
      createdAt: v.number(),
      editedAt: v.optional(v.number()),
      replyToId: v.optional(v.id("messages")),
      clientId: v.optional(v.string()),
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
    })
      .index("by_container", ["containerId", "createdAt"])
      .index("by_container_client", ["containerId", "clientId"])
      .index("by_author", ["authorId"])
      .searchIndex("search_content", {
        searchField: "content",
        filterFields: ["containerType"],
      }),

    reactions: defineTable({
      messageId: v.id("messages"),
      userId: v.id("users"),
      emoji: v.string(),
      createdAt: v.number(),
    })
      .index("by_message", ["messageId"])
      .index("by_message_user", ["messageId", "userId"]),

    /** Read cursor per user per channel or conversation (`key` is either id). */
    reads: defineTable({
      userId: v.id("users"),
      key: v.string(),
      lastReadAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user_key", ["userId", "key"])
      .index("by_user", ["userId"]),

    invites: defineTable({
      code: v.string(),
      serverId: v.id("servers"),
      creatorId: v.id("users"),
      createdAt: v.number(),
      expiresAt: v.optional(v.number()),
      maxUses: v.optional(v.number()),
      uses: v.number(),
      revoked: v.optional(v.boolean()),
    })
      .index("by_code", ["code"])
      .index("by_server", ["serverId"]),

    bans: defineTable({
      serverId: v.id("servers"),
      userId: v.id("users"),
      reason: v.optional(v.string()),
      bannedBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_server_user", ["serverId", "userId"])
      .index("by_server", ["serverId"]),

    auditLogs: defineTable({
      serverId: v.id("servers"),
      actorId: v.id("users"),
      action: v.string(),
      targetType: v.optional(v.string()),
      targetId: v.optional(v.string()),
      details: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_server", ["serverId", "createdAt"]),

    notifications: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("friend_request"),
        v.literal("friend_accept"),
        v.literal("mention"),
        v.literal("reply"),
        v.literal("moderation"),
        v.literal("system"),
      ),
      title: v.string(),
      body: v.optional(v.string()),
      actorId: v.optional(v.id("users")),
      /** Client route to open, e.g. `/dashboard/s/<server>/c/<channel>`. */
      link: v.optional(v.string()),
      /** Channel/conversation key so opening it can clear the badge. */
      containerKey: v.optional(v.string()),
      read: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_unread", ["userId", "read"]),

    reports: defineTable({
      reporterId: v.id("users"),
      reportedUserId: v.optional(v.id("users")),
      messageId: v.optional(v.id("messages")),
      serverId: v.optional(v.id("servers")),
      reason: v.string(),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("open"),
        v.literal("reviewing"),
        v.literal("resolved"),
        v.literal("dismissed"),
      ),
      resolution: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_reported", ["reportedUserId"])
      .index("by_reporter", ["reporterId"]),

    /** Ephemeral typing rows; expire a few seconds after the last keystroke. */
    typing: defineTable({
      key: v.string(),
      userId: v.id("users"),
      expiresAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_expires", ["expiresAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
