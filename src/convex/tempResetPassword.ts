import { v } from "convex/values";
import {
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/** One-off helper: look up an account by handle and its password credential. */
export const lookup = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const handle = username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", handle))
      .unique();
    if (!user) return null;
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password"),
      )
      .unique();
    return {
      userId: user._id as string,
      name: user.name ?? null,
      email: user.email ?? null,
      hasPassword: account !== null,
      credentialId: account?.providerAccountId ?? null,
    };
  },
});

/** One-off helper: set an account's password by handle, then verify it. */
export const resetPassword = internalAction({
  args: { username: v.string(), newPassword: v.string() },
  handler: async (ctx, { username, newPassword }) => {
    const target = await ctx.runQuery(internal.tempResetPassword.lookup, {
      username,
    });
    if (!target) throw new Error(`No account with the handle "${username}".`);
    if (!target.credentialId) {
      throw new Error(`"${username}" has no password credential.`);
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: target.credentialId, secret: newPassword },
    });

    // Verify exactly the way sign-in does.
    const verified = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: target.credentialId, secret: newPassword },
    }).catch(() => null);
    if (!verified || verified.user._id !== target.userId) {
      throw new Error("Password was written but sign-in verification failed.");
    }

    return {
      userId: target.userId,
      name: target.name,
      email: target.email,
      verified: true,
    };
  },
});
