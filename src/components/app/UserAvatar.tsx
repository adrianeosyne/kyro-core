import { initials, PRESENCE_META, seedColor, type PresenceState } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AvatarUser {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  presence?: PresenceState;
}

const SIZES = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

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
  const meta = PRESENCE_META[presence];
  const dotSize = {
    xs: "size-2 border",
    sm: "size-2.5 border-[1.5px]",
    md: "size-3 border-2",
    lg: "size-5 border-[3px]",
    xl: "size-7 border-4",
  }[size];

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
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
