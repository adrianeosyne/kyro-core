import { CrownBadge } from "@/components/app/CrownBadge";
import { cn } from "@/lib/utils";

/**
 * Kyro's platform-wide (global) badges — shown in their own dedicated
 * "Badges" shelf on a profile, deliberately separate from community roles.
 *
 * Every icon here is original 2D vector artwork drawn for Kyro:
 *  - founder  — the crown (same art as the inline crown badge)
 *  - admin    — shield + star, rose gradient
 *  - moderator— shield + check, emerald gradient
 *  - verified — scalloped seal + check, blue gradient
 */
export type GlobalBadgeKey = "founder" | "admin" | "moderator" | "verified";

export const GLOBAL_BADGE_META: Record<
  GlobalBadgeKey,
  { label: string; blurb: string; chip: string }
> = {
  founder: {
    label: "Kyro Founder",
    blurb: "Built Kyro from the ground up.",
    chip: "border-blue-400/40 bg-blue-500/10 text-blue-500 dark:text-blue-300",
  },
  admin: {
    label: "Admin",
    blurb: "Runs the Kyro platform.",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  moderator: {
    label: "Moderator",
    blurb: "Keeps Kyro safe for everyone.",
    chip: "border-success/40 bg-success/10 text-success",
  },
  verified: {
    label: "Verified",
    blurb: "Verified by the Kyro team.",
    chip: "border-brand/40 bg-brand/10 text-brand",
  },
};

/** The three badges staff can grant (founder is derived from the account). */
export const GRANTABLE_BADGES = ["admin", "moderator", "verified"] as const;
export type GrantableBadge = (typeof GRANTABLE_BADGES)[number];

/** Inline display order — compact rows show only the highest of these. */
export const BADGE_PRIORITY: GlobalBadgeKey[] = [
  "founder",
  "admin",
  "moderator",
  "verified",
];

/** The single highest-priority badge a user holds, or null for none. */
export function topGlobalBadge(
  badges: readonly string[],
): GlobalBadgeKey | null {
  return (
    BADGE_PRIORITY.find((badge) => badges.includes(badge)) ?? null
  );
}

/**
 * Inline badge next to a name, styled exactly like the founder crown:
 * renders the user's *highest* badge only (founder → admin → moderator →
 * verified), falling back to nothing when they hold none.
 */
export function InlineBadge({
  badges,
  size = "size-3.5",
}: {
  badges: readonly string[];
  /** Matches CrownBadge's default inline size. */
  size?: string;
}) {
  const top = topGlobalBadge(badges);
  if (!top) return null;
  if (top === "founder") {
    return <CrownBadge variant="founder" label="Kyro founder" size={size} />;
  }
  const label = GLOBAL_BADGE_META[top].label;
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center align-middle"
    >
      <GlobalBadgeIcon badge={top} className={size} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Scalloped bumps around the "verified" seal, as one merged silhouette. */
const SEAL_BUMPS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  return {
    cx: +(12 + 9.3 * Math.cos(angle)).toFixed(2),
    cy: +(12 + 9.3 * Math.sin(angle)).toFixed(2),
  };
});

/** A single 2D badge icon. Purely decorative — labels live outside. */
export function GlobalBadgeIcon({
  badge,
  className,
}: {
  badge: GlobalBadgeKey;
  className?: string;
}) {
  if (badge === "founder") {
    return <CrownBadge variant="founder" label="Kyro founder" size={className ?? "size-4"} />;
  }

  const gradientId = `kyroBadge_${badge}`;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("size-4 shrink-0", className)}
    >
      <defs>
        {badge === "admin" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="55%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
        )}
        {badge === "moderator" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        )}
        {badge === "verified" && (
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        )}
      </defs>

      {badge === "admin" && (
        <>
          <path
            d="M12 2.7 4.7 5.2v6.1c0 4.5 3 8.6 7.3 9.9 4.3-1.3 7.3-5.4 7.3-9.9V5.2Z"
            fill={`url(#${gradientId})`}
            stroke="#9f1239"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path
            d="M12 7.9 12.94 10.31 15.52 10.46 13.52 12.09 14.17 14.59 12 13.2 9.83 14.59 10.48 12.09 8.48 10.46 11.06 10.31Z"
            fill="#ffffff"
            opacity="0.95"
          />
        </>
      )}

      {badge === "moderator" && (
        <>
          <path
            d="M12 2.7 4.7 5.2v6.1c0 4.5 3 8.6 7.3 9.9 4.3-1.3 7.3-5.4 7.3-9.9V5.2Z"
            fill={`url(#${gradientId})`}
            stroke="#065f46"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path
            d="m8.4 12.2 2.5 2.5 4.7-5.1"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {badge === "verified" && (
        <>
          <g fill={`url(#${gradientId})`}>
            <circle cx="12" cy="12" r="9.3" />
            {SEAL_BUMPS.map((bump) => (
              <circle key={`${bump.cx}-${bump.cy}`} cx={bump.cx} cy={bump.cy} r="2.6" />
            ))}
          </g>
          <path
            d="M6.6 8.9a7.2 7.2 0 0 1 5.4-3.1"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="m8.4 12.3 2.5 2.5 4.7-5.2"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

/** One badge rendered as a labelled pill — the unit of the badge shelf. */
export function GlobalBadgeChip({
  badge,
  className,
}: {
  badge: GlobalBadgeKey;
  className?: string;
}) {
  const meta = GLOBAL_BADGE_META[badge];
  return (
    <span
      title={meta.blurb}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        meta.chip,
        className,
      )}
    >
      <GlobalBadgeIcon badge={badge} />
      {meta.label}
    </span>
  );
}

/**
 * The dedicated global-badges shelf: every platform-wide badge a user holds,
 * with its own heading and styling so it never mixes up with community roles.
 */
export function GlobalBadges({
  badges,
  className,
}: {
  badges: GlobalBadgeKey[];
  className?: string;
}) {
  if (badges.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No global badges yet.
      </p>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((badge) => (
        <GlobalBadgeChip key={badge} badge={badge} />
      ))}
    </div>
  );
}
