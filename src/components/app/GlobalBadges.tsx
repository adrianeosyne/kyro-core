import { CrownBadge } from "@/components/app/CrownBadge";
import { cn } from "@/lib/utils";

/**
 * Kyro's platform-wide (global) badges — shown in their own dedicated
 * "Badges" shelf on a profile, deliberately separate from community roles.
 *
 * Every icon here is original 2D vector artwork drawn for Kyro:
 *  - founder   — the crown (same art as the inline crown badge)
 *  - admin     — shield + star, rose gradient
 *  - moderator — shield + check, emerald gradient
 *  - verified  — scalloped seal + check, blue gradient
 *  - bughunter — bug inside a scalloped ring, amber gradient
 *  - vip       — diamond, violet gradient
 *  - og        — rocket, teal gradient
 *  - supporter — heart, rose gradient
 *  - donator   — coin, gold gradient
 *  - partner   — linked rings, indigo gradient
 */
export type GlobalBadgeKey =
  | "founder"
  | "admin"
  | "moderator"
  | "verified"
  | "bughunter"
  | "vip"
  | "og"
  | "supporter"
  | "donator"
  | "partner";

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
  bughunter: {
    label: "Bug Hunter",
    blurb: "Helped squash bugs in Kyro.",
    chip: "border-amber-400/40 bg-amber-500/10 text-amber-500 dark:text-amber-300",
  },
  vip: {
    label: "VIP",
    blurb: "A very important Kyro member.",
    chip: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-500 dark:text-fuchsia-300",
  },
  og: {
    label: "OG",
    blurb: "Been here since the early days.",
    chip: "border-teal-400/40 bg-teal-500/10 text-teal-500 dark:text-teal-300",
  },
  supporter: {
    label: "Supporter",
    blurb: "Stands behind Kyro.",
    chip: "border-rose-400/40 bg-rose-500/10 text-rose-500 dark:text-rose-300",
  },
  donator: {
    label: "Donator",
    blurb: "Donated to help Kyro grow.",
    chip: "border-yellow-400/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300",
  },
  partner: {
    label: "Partner",
    blurb: "An official Kyro partner.",
    chip: "border-indigo-400/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-300",
  },
};

/** Badges staff can grant (founder is derived from the account). */
export const GRANTABLE_BADGES = [
  "admin",
  "moderator",
  "verified",
  "bughunter",
  "vip",
  "og",
  "supporter",
  "donator",
  "partner",
] as const;
export type GrantableBadge = (typeof GRANTABLE_BADGES)[number];

/** Inline display order — compact rows show only the highest of these. */
export const BADGE_PRIORITY: GlobalBadgeKey[] = [
  "founder",
  "admin",
  "moderator",
  "partner",
  "bughunter",
  "vip",
  "og",
  "donator",
  "supporter",
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
 * Inline badge next to a name, styled exactly like the founder crown.
 * Shows the badge the user picked in Settings → Profile → Badge (when they
 * hold it), else their highest one (founder → admin → moderator →
 * verified). `primaryBadge="none"` hides inline badges everywhere — the
 * profile card still shows the full shelf.
 */
export function InlineBadge({
  badges,
  primaryBadge,
  size = "size-3.5",
}: {
  badges: readonly string[];
  /** This user's chosen inline badge: a held badge id, "none", or unset. */
  primaryBadge?: string | null;
  /** Matches CrownBadge's default inline size. */
  size?: string;
}) {
  if (primaryBadge === "none") return null;
  const chosen =
    primaryBadge && primaryBadge !== "none" && badges.includes(primaryBadge)
      ? (primaryBadge as GlobalBadgeKey)
      : topGlobalBadge(badges);
  if (!chosen) return null;
  if (chosen === "founder") {
    return <CrownBadge variant="founder" label="Kyro founder" size={size} />;
  }
  const label = GLOBAL_BADGE_META[chosen].label;
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center align-middle"
    >
      <GlobalBadgeIcon badge={chosen} className={size} />
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
      style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.28))" }}
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
        {badge === "bughunter" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        )}
        {badge === "vip" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        )}
        {badge === "og" && (
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="55%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        )}
        {badge === "supporter" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        )}
        {badge === "donator" && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="55%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        )}
        {badge === "partner" && (
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#3730a3" />
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

      {badge === "bughunter" && (
        <>
          <circle cx="12" cy="12" r="8.6" fill={`url(#${gradientId})`} opacity="0.28" />
          <circle
            cx="12"
            cy="12"
            r="8.6"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.1"
          />
          {/* beetle body */}
          <ellipse cx="12" cy="13.1" rx="3.3" ry="4.3" fill={`url(#${gradientId})`} />
          <circle cx="12" cy="8.4" r="2.1" fill={`url(#${gradientId})`} />
          {/* legs */}
          <g stroke={`url(#${gradientId})`} strokeWidth="1.1" strokeLinecap="round">
            <path d="M8.9 11.2 6.9 9.6M8.7 13.2H6.5M8.9 15.2l-2 1.6" />
            <path d="M15.1 11.2 17.1 9.6M15.3 13.2h2.2M15.1 15.2l2 1.6" />
          </g>
          {/* antennae */}
          <path
            d="M11 6.7 9.9 5.4M13 6.7l1.1-1.3"
            stroke={`url(#${gradientId})`}
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* shell split */}
          <path
            d="M12 9.4v7.2"
            stroke="#7c2d12"
            strokeOpacity="0.55"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </>
      )}

      {badge === "vip" && (
        <>
          {/* diamond */}
          <path
            d="M7.6 4.6h8.8l3.4 4.6L12 19.6 4.2 9.2Z"
            fill={`url(#${gradientId})`}
            stroke="#5b21b6"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path
            d="M7.6 4.6 12 19.6 16.4 4.6"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <path
            d="M4.2 9.2h15.6"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <path
            d="M8.7 6.9h3.1l-1.6 3.9Z"
            fill="#ffffff"
            fillOpacity="0.85"
          />
        </>
      )}

      {badge === "og" && (
        <>
          {/* rocket */}
          <path
            d="M12 3.4c2.9 2.2 4.3 5.3 4.3 8.7l-1.7 3.1H9.4l-1.7-3.1c0-3.4 1.4-6.5 4.3-8.7Z"
            fill={`url(#${gradientId})`}
            stroke="#115e59"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9.6" r="1.9" fill="#ffffff" fillOpacity="0.85" />
          <path
            d="M7.7 11.4 5.4 14.8l2.8-.7M16.3 11.4l2.3 3.4-2.8-.7"
            fill={`url(#${gradientId})`}
            stroke="#115e59"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path
            d="M10.7 16.2h2.6l-.6 2.1-1.6 1.9-1.6-1.9Z"
            fill="#ffffff"
            fillOpacity="0.85"
          />
          <path
            d="M12 15.9v1.8"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}

      {badge === "supporter" && (
        <>
          {/* heart */}
          <path
            d="M12 19.7C7.4 16.5 4.1 13.6 4.1 10.2A4.1 4.1 0 0 1 12 8.4a4.1 4.1 0 0 1 7.9 1.8c0 3.4-3.3 6.3-7.9 9.5Z"
            fill={`url(#${gradientId})`}
            stroke="#9f1239"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path
            d="M8.6 7.6c1.4-.6 2.6-.2 3.2.9"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}

      {badge === "donator" && (
        <>
          {/* coin with a sparkle */}
          <circle
            cx="12"
            cy="12"
            r="8.4"
            fill={`url(#${gradientId})`}
            stroke="#92400e"
            strokeWidth="0.9"
          />
          <circle
            cx="12"
            cy="12"
            r="6.1"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          <path
            d="M12 7.4v9.2M14.3 9.3c-.5-.9-3.9-1.4-4.4.5-.5 1.9 4.5 1.4 4.5 3.4 0 2-3.9 1.7-4.6.5"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.9"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </>
      )}

      {badge === "partner" && (
        <>
          {/* two linked rings */}
          <circle
            cx="9.2"
            cy="12"
            r="5.1"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.4"
          />
          <circle
            cx="14.8"
            cy="12"
            r="5.1"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.4"
            strokeOpacity="0.72"
          />
          <path
            d="M12 9.1a5.1 5.1 0 0 0 0 5.8 5.1 5.1 0 0 0 0-5.8Z"
            fill="#ffffff"
            fillOpacity="0.9"
          />
        </>
      )}

      {/* Shared gloss: a soft highlight arc that makes every badge read as a
          single, coherent icon family instead of six unrelated drawings. */}
      {badge !== "bughunter" && (
        <path
          d="M6.2 8.4a7.6 7.6 0 0 1 5.6-4.4"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
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
