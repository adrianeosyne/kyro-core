import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export type Ctx = QueryCtx | MutationCtx;

/** A user is considered online if they heartbeated within this window. */
export const PRESENCE_TIMEOUT_MS = 60_000;

/** Resolve the account id of the signed-in user. */
export async function getAuthUserIdOrThrow(
  ctx: Ctx,
): Promise<Id<"users">> {
  const id = await getAuthUserId(ctx);
  if (id === null) throw new Error("You need to sign in to do that.");
  return id;
}

/** Get the current signed in user. Returns null if the user is not signed in. */
export async function currentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const id = await getAuthUserId(ctx);
  if (id === null) return null;
  return await ctx.db.get(id);
}
