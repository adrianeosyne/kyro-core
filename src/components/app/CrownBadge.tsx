import { cn } from "@/lib/utils";

/**
 * Kyro's crown badge — original artwork, not a stock icon.
 *
 * A filled three-point crown on a blue gradient chip:
 *  - `founder` — adrianeosyne's platform-wide badge, visible to everyone.
 *  - `owner`   — a server's owner, only ever rendered inside views that
 *                server's members can see (member list, that server's chat).
 */
export function CrownBadge({
  label,
  variant = "owner",
  className,
  size = "size-3.5",
}: {
  /** Tooltip + screen-reader text, e.g. "Server owner". */
  label: string;
  variant?: "founder" | "owner";
  className?: string;
  size?: string;
}) {
  const gradientId =
    variant === "founder" ? "kyroCrownFounder" : "kyroCrownOwner";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center",
        variant === "founder" && "drop-shadow-[0_0_5px_rgba(59,130,246,0.65)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className={cn(size, "shrink-0")}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <path
          d="M3.2 7 7.9 11.5 12 4.6 16.1 11.5 20.8 7 19.1 17.4a1.6 1.6 0 0 1-1.6 1.4H6.5a1.6 1.6 0 0 1-1.6-1.4Z"
          fill={`url(#${gradientId})`}
          stroke="#1e40af"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <circle cx="3.2" cy="7" r="1.15" fill="#bfdbfe" />
        <circle cx="12" cy="4.6" r="1.35" fill="#dbeafe" />
        <circle cx="20.8" cy="7" r="1.15" fill="#bfdbfe" />
        <path
          d="M7.4 15.4h9.2"
          stroke="#dbeafe"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
