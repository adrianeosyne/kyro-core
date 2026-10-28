/** Small presentation helpers shared across the Kyro interface. */

export type PresenceState = "online" | "idle" | "dnd" | "invisible" | "offline";

export const PRESENCE_META: Record<
  PresenceState,
  { label: string; dot: string; text: string; hex: string; glyph: string }
> = {
  online: {
    label: "Online",
    dot: "bg-success",
    text: "text-success",
    hex: "#22c55e",
    glyph: "Online",
  },
  idle: {
    label: "Idle",
    dot: "bg-warning",
    text: "text-warning",
    hex: "#f59e0b",
    glyph: "Idle",
  },
  dnd: {
    label: "Do not disturb",
    dot: "bg-destructive",
    text: "text-destructive",
    hex: "#ef4444",
    glyph: "Do not disturb",
  },
  invisible: {
    label: "Invisible",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    hex: "#94a3b8",
    glyph: "Invisible",
  },
  offline: {
    label: "Offline",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    hex: "#64748b",
    glyph: "Offline",
  },
};

/** Coerces anything (including stale payloads) to a real presence state. */
export function normalizePresence(value: unknown): PresenceState {
  return typeof value === "string" && value in PRESENCE_META
    ? (value as PresenceState)
    : "offline";
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(timestamp) === dayKey(today.getTime())) return "Today";
  if (dayKey(timestamp) === dayKey(yesterday.getTime())) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Deterministic colour so a user keeps the same avatar tint everywhere. */
export function seedColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 62% 48%)`;
}

export function displayName(user: {
  name?: string | null;
  username?: string | null;
} | null): string {
  if (!user) return "Unknown user";
  return user.name || user.username || "Kyro user";
}

export function shortName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Discord-style grouped message timestamps for chat histories. */
export function conversationName(
  type: "dm" | "group",
  name: string | null,
  others: { name: string }[],
): string {
  if (type === "group") return name || others.map((user) => user.name).slice(0, 3).join(", ") || "Group message";
  return others[0]?.name ?? "Direct message";
}
