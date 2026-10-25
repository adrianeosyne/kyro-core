import { cn } from "@/lib/utils";

/**
 * Kyro's geometric mark: a rounded tile with a hard-edged K cut out of it.
 * Original artwork — a single path plus a stem, no external assets.
 */
export function KyroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Kyro"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient id="kyroMarkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="14" fill="url(#kyroMarkGradient)" />
      <g fill="#0B0D12">
        <rect x="13.5" y="11" width="6" height="26" rx="1.5" />
        <path d="M20.5 24 L31.5 11 H39.5 L28.4 24 L39.5 37 H31.5 Z" />
      </g>
    </svg>
  );
}

export function KyroWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <KyroMark className="size-7" />
      <span className="text-lg font-semibold tracking-tight">Kyro</span>
    </span>
  );
}
