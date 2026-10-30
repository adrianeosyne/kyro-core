import { v } from "convex/values";
import axios from "axios";
import {
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Forgot password: request a code by email, then trade it for a new password.
 *
 * The code is delivered by the same Freebuff integrations gateway that mails
 * sign-in codes (see auth/emailOtp.ts), so no new email provider or key is
 * needed. Requests are anonymous to outsiders — asking about an address that
 * has no account looks exactly like asking about one that does.
 */

/** Codes live for 10 minutes. */
const CODE_TTL_MS = 10 * 60_000;
/** At most one code per minute per address, five per hour. */
const COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;
/** Wrong guesses before the code is burned. */
const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The account behind an address, plus whether it signs in with a password. */
export const accountForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
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
      hasPassword: account !== null,
    };
  },
});

/** Store a fresh code for an address, respecting the send limits. */
export const prepare = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const recent = rows.filter((row) => now - row.createdAt < 60 * 60_000);
    const throttled =
      recent.some((row) => now - row.createdAt < COOLDOWN_MS) ||
      recent.length >= MAX_SENDS_PER_HOUR;
    if (throttled) return { throttled: true };

    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.insert("passwordResetCodes", {
      email,
      code,
      attempts: 0,
      expiresAt: now + CODE_TTL_MS,
      createdAt: now,
    });
    return { throttled: false };
  },
});

/**
 * Check a code. Throws with a human message on any failure; a correct code
 * consumes the row so it can never be replayed.
 */
export const verify = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const row = rows
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!row) {
      throw new Error("That code is no longer valid. Request a new one.");
    }
    if (row.expiresAt <= now) {
      await ctx.db.delete(row._id);
      throw new Error("That code has expired. Request a new one.");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(row._id);
      throw new Error("Too many wrong attempts — that code was canceled.");
    }
    if (row.code !== code) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      const left = MAX_ATTEMPTS - (row.attempts + 1);
      throw new Error(
        left > 0
          ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts — that code was canceled.",
      );
    }
    await ctx.db.delete(row._id);
    return { ok: true as const };
  },
});

/** Mail the code through the same gateway sign-in codes use. */
async function sendCodeEmail(to: string, code: string): Promise<void> {
  const base =
    process.env.VLY_INTEGRATION_BASE_URL || "https://integrations.vly.ai";
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "Password reset emails aren't configured on this deployment yet.",
    );
  }
  try {
    await axios.post(
      `${base.replace(/\/+$/, "")}/v1/email/otp`,
      { to, otp: code },
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15_000,
      },
    );
  } catch (error) {
    const response = (
      error as { response?: { status?: number; data?: { error?: unknown } } }
    )?.response;
    if (response) {
      const detail =
        typeof response.data?.error === "string"
          ? `: ${response.data.error}`
          : "";
      throw new Error(`Couldn't send the code (HTTP ${response.status})${detail}.`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't send the code: ${message}`);
  }
}

/** Step 1 — mail a 6-digit code to the address, if that address has an account. */
export const requestCode = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const clean = normalizeEmail(email);
    if (!EMAIL_RE.test(clean) || clean.length > 254) {
      throw new Error("Enter a valid email address.");
    }
    const account = await ctx.runQuery(internal.passwordReset.accountForEmail, {
      email: clean,
    });
    // Unknown address (or one that has no password): answer the same way we
    // would for a real account so addresses can't be probed from here.
    if (!account || !account.hasPassword) {
      return { ok: true as const, sent: false, throttled: false };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { throttled } = await ctx.runMutation(internal.passwordReset.prepare, {
      email: clean,
      code,
    });
    if (throttled) {
      return { ok: true as const, sent: false, throttled: true };
    }
    await sendCodeEmail(clean, code);
    return { ok: true as const, sent: true, throttled: false };
  },
});

/** Step 2 — trade the code for a new password and sign every session out. */
export const resetPassword = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }) => {
    const clean = normalizeEmail(email);
    const digits = code.trim();
    if (!/^\d{6}$/.test(digits)) {
      throw new Error("Enter the 6-digit code from your email.");
    }
    if (newPassword.length < 8) {
      throw new Error("New passwords need at least 8 characters.");
    }
    if (newPassword.length > 200) {
      throw new Error("New passwords can be at most 200 characters.");
    }
    const account = await ctx.runQuery(internal.passwordReset.accountForEmail, {
      email: clean,
    });
    if (!account) {
      throw new Error("That code is no longer valid. Request a new one.");
    }
    if (!account.hasPassword) {
      throw new Error(
        "This account signs in with email codes, so it has no password to reset.",
      );
    }

    await ctx.runMutation(internal.passwordReset.verify, {
      email: clean,
      code: digits,
    });

    // Same helper sign-in and Settings → change password use, so the stored
    // credential format never drifts between the three paths.
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: clean, secret: newPassword },
    });

    // Prove the new password actually signs in before telling anyone it did.
    const verified = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: clean, secret: newPassword },
    }).catch(() => null);
    if (!verified) {
      throw new Error("The password was saved but sign-in failed. Try again.");
    }

    // A reset means the old password may be compromised: end every session.
    await invalidateSessions(ctx, {
      userId: account.userId as Id<"users">,
    }).catch(() => undefined);

    return { ok: true as const };
  },
});
