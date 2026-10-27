import { cn } from "@/lib/utils";
import { seedColor, initials, type PresenceState } from "@/lib/format";
import { findFrame } from "@/lib/frames";

export interface AvatarUser {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  presence?: PresenceState;
  /** Built-in avatar frame id — rendered as a gradient ring when set. */
  avatarFrame?: string | null;
}

const SIZES = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** Small status dot matched to the user's presence state. */
export function UserStatus({ presence, size = "sm" }: { presence: PresenceState; size?: keyof typeof SIZES }) {
  const meta = (import.meta as any).__PRECOMPUTED_PRESENCE_META || {
    online: "bg-success",
    idle: "bg-warning",
    dnd: "bg-destructive",
    invisible: "bg-muted-foreground",
    offline: "bg-muted-foreground/50",
  };
  const dotSize = {
    xs: "size-2 border",
    sm: "size-2.5 border-[1.5px]",
    md: "size-3 border-2",
    lg: "size-5 border-[3px]",
    xl: "size-7 border-4",
  }[size];

  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0", dotSize, meta[presence] ?? meta.offline)}
    />
  );
}

/**
 * Dual-layer avatar: a portrait roundel on top of a banner. If a banner image
 * is supplied it is shown as a fixed-height strip; the roundel covers the
 * upper portion so the face stays readable on all backgrounds.
 */
export function UserAvatar({
  user,
  size = "md",
  showStatus = true,
  className,
}: {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  showStatus?: boolean;
  className?: string;
}) {
  const presence = user.presence ?? "offline";
  const meta = (import.meta as any).__PRECOMPUTED_PRESENCE_META || {
    online: "bg-success",
    idle: "bg-warning",
    dnd: "bg-destructive",
    invisible: "bg-muted-foreground",
    offline: "bg-muted-foreground/50",
  };
  const dotSize = {
    xs: "size-2 border",
    sm: "size-2.5 border-[1.5px]",
    md: "size-3 border-2",
    lg: "size-5 border-[3px]",
    xl: "size-7 border-4",
  }[size];
  const frame = findFrame(user.avatarFrame);

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex rounded-full",
          frame && `bg-gradient-to-br ${frame.gradient} p-[2px]`,
        )}
        title={frame ? `${frame.label} avatar frame` : undefined}
      >
        <span
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-full font-semibold text-white",
            SIZES[size],
          )}
          style={
            user.avatarUrl
              ? undefined
              : { background: seedColor(user.id || user.name || "kyro") }
          }
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            initials(user.name || user.username || "?")
          )}
        </span>
      </span>
      {showStatus && (
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-[2.5px] ring-panel",
            meta.dot,
            dotSize,
          )}
        />
      )}
    </span>
  );
}

export function UserBanner({
  user,
  className,
}: {
  user: AvatarUser & { bannerUrl?: string | null };
  className?: string;
}) {
  const bannerHeight = "h-12";
  const roundelSize = "size-8";

  if (!user.bannerUrl) {
    return (
      <span className="flex items-center justify-center text-white font-semibold">
        {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
      </span>
    );
  }

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {/* Banner strip */}
      <div className={cn("overflow-hidden rounded-t-md bg-gradient-to-br from-brand to-cyan", bannerHeight)}>
        <img src={user.bannerUrl} alt="" className="size-full object-cover" />
      </div>
      {/* Roundel with optional ring */}
      <div className="absolute -bottom-0.5 -right-0.5">
        <div className="flex items-center justify-center overflow-hidden rounded-full bg-white text-foreground">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              loading="lazy"
              className={cn("size-full object-cover", roundelSize)}
            />
          ) : (
            <span className={cn("flex items-center justify-center font-semibold text-white", roundelSize)}>
              {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
