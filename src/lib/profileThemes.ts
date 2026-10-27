/**
 * Profile theme presets — gradient washes for a user's profile card and
 * banner fallback. Shared by the client (picker + card renderer) and Convex
 * (validation on save), so the id list lives in exactly one place. Class
 * names are written out literally so Tailwind picks them up from this file.
 */
export interface ProfileTheme {
  id: string;
  label: string;
  /** Gradient classes applied as `bg-gradient-to-br ${gradient}`. */
  gradient: string;
  /** Solid mid colour for spots that can't take a gradient. */
  solid: string;
}

export const PROFILE_THEMES: ProfileTheme[] = [
  { id: "sunset", label: "Sunset", gradient: "from-orange-400 via-rose-400 to-pink-500", solid: "#f97316" },
  { id: "ocean", label: "Ocean", gradient: "from-sky-400 via-cyan-400 to-teal-500", solid: "#0ea5e9" },
  { id: "grape", label: "Grape", gradient: "from-fuchsia-500 via-purple-500 to-indigo-500", solid: "#a855f7" },
  { id: "mint", label: "Mint", gradient: "from-emerald-400 via-teal-400 to-cyan-500", solid: "#10b981" },
  { id: "midnight", label: "Midnight", gradient: "from-slate-700 via-blue-900 to-indigo-900", solid: "#334155" },
  { id: "cherry", label: "Cherry", gradient: "from-red-400 via-rose-500 to-red-600", solid: "#ef4444" },
  { id: "gold", label: "Gold", gradient: "from-amber-300 via-yellow-400 to-orange-500", solid: "#f59e0b" },
  { id: "aurora", label: "Aurora", gradient: "from-blue-400 via-cyan-300 to-emerald-400", solid: "#3b82f6" },
  { id: "rose", label: "Rose", gradient: "from-rose-300 via-pink-400 to-rose-500", solid: "#f43f5e" },
  { id: "forest", label: "Forest", gradient: "from-green-500 via-emerald-500 to-teal-600", solid: "#22c55e" },
  { id: "neon", label: "Neon", gradient: "from-lime-400 via-cyan-400 to-blue-500", solid: "#84cc16" },
  { id: "candy", label: "Candy", gradient: "from-pink-400 via-rose-300 to-orange-300", solid: "#ec4899" },
];

export const PROFILE_THEME_IDS: string[] = PROFILE_THEMES.map(
  (theme) => theme.id,
);

/** Looks up a preset by id; unknown ids fall back to the default look. */
export function findProfileTheme(
  id: string | null | undefined,
): ProfileTheme | null {
  if (!id) return null;
  return PROFILE_THEMES.find((theme) => theme.id === id) ?? null;
}
