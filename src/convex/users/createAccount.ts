import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { convexAuth } from "@convex-dev/auth/server";
import { getAuthUserIdOrThrow } from "./lib";

/** Register a new account with email + password. No email verification is
 *  sent: the password provider hashes the password with Scrypt and signs the
 *  user in immediately. The username is claimed afterwards on the client. */
export const createAccount = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, username, name }) => {
    const { id } = await getAuthUserIdOrThrow(ctx);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email.toLowerCase()),
      )
      .unique();
    const user = account
      ? (await ctx.db.get(account.userId))!
      : null;

    if (!user) {
      const { _id: userId } = await convexAuth.store.mutate({
        type: "createAccountFromCredentials",
        provider: "password",
        account: {
          id: email.toLowerCase(),
          secret: password,
        },
        profile: {
          email: email.toLowerCase(),
          name: name ?? username,
        },
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      });

      await ctx.db.patch(userId, {
        username: username.toLowerCase(),
        name: name ?? username,
        email: email.toLowerCase(),
        avatarStorageId: undefined,
        bio: undefined,
        customStatus: undefined,
        status: "online",
        createdAt: Date.now(),
        lastSeen: Date.now(),
        dmPolicy: "everyone",
        allowFriendRequests: true,
        showPresence: true,
      });

      return userId;
    }

    // User already exists (e.g. guest-created account): attach the password
    // credentials and record the Kyro profile without creating a duplicate.
    await convexAuth.store.mutate({
      type: "createAccountFromCredentials",
      provider: "password",
      account: {
        id: email.toLowerCase(),
        secret: password,
      },
      profile: {
        email: email.toLowerCase(),
        name: name ?? username,
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    await ctx.db.patch(user._id, {
      username: username.toLowerCase(),
      name: name ?? username,
      email: email.toLowerCase(),
      avatarStorageId: undefined,
      bio: undefined,
      customStatus: undefined,
      status: "online",
      createdAt: Date.now(),
      lastSeen: Date.now(),
      dmPolicy: "everyone",
      allowFriendRequests: true,
      showPresence: true,
    });

    return user._id;
  },
});
