import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireProfile, type Ctx } from "./lib";
import { createAccount, convexAuth } from "@convex-dev/auth/server";

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
    const { id } = await requireProfile(ctx);

    const { account, user } = await createAccount(ctx, {
      provider: "password",
      account: {
        id: email.toLowerCase(),
        secret: password,
      },
      profile: {
        email: email.toLowerCase(),
        name: name ?? username,
      },
      // Do not attach the email provider's verification flow; the password
      // provider handles sign-up on its own.
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    // Patch the Kyro profile with the handle and display name we recorded
    // because the generic account creation does not know about them.
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
