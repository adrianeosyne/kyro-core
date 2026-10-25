import { mutation } from "./_generated/server";
import { requireUser } from "./lib";

/**
 * Files go straight to Convex object storage (S3-compatible under the hood)
 * via a short-lived signed upload URL — no file bytes through the database.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
