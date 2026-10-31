/**
 * App-wide colour tints for Settings → Appearance → Colour themes.
 *
 * Each tint washes the whole interface: it recolours the primary/brand
 * tokens and lays a faint gradient over the background. `a`/`b` are the
 * gradient stops, `solid` is the representative colour used where a single
 * colour is needed (buttons, links, focus rings). Class-free — values are
 * applied as CSS custom properties from src/lib/store.ts.
 */
export interface AppTint {
  id: string;
  a: string;
  b: string;
  solid: string;
}

export const APP_TINTS: AppTint[] = [
  { id: "jade", a: "#5eead4", b: "#34d399", solid: "#10b981" },
  { id: "sunbeam", a: "#fde68a", b: "#fbbf24", solid: "#f59e0b" },
  { id: "periwinkle", a: "#a5b4fc", b: "#818cf8", solid: "#6366f1" },
  { id: "coral", a: "#fdba74", b: "#fb7185", solid: "#f97316" },
  { id: "tangerine", a: "#fdba74", b: "#f97316", solid: "#ea580c" },
  { id: "iris", a: "#c4b5fd", b: "#8b5cf6", solid: "#7c3aed" },
  { id: "fern", a: "#6ee7b7", b: "#10b981", solid: "#059669" },
  { id: "citron", a: "#fde047", b: "#a3e635", solid: "#ca8a04" },
  { id: "blush", a: "#fda4af", b: "#fb7185", solid: "#f43f5e" },
  { id: "sky", a: "#93c5fd", b: "#60a5fa", solid: "#3b82f6" },
  { id: "lagoon", a: "#5eead4", b: "#14b8a6", solid: "#0d9488" },
  { id: "crimson", a: "#f87171", b: "#b91c1c", solid: "#dc2626" },
  { id: "violet", a: "#a78bfa", b: "#7c3aed", solid: "#6d28d9" },
  { id: "rust", a: "#fb923c", b: "#c2410c", solid: "#c2410c" },
  { id: "lavender", a: "#c4b5fd", b: "#a78bfa", solid: "#8b5cf6" },
  { id: "teal", a: "#2dd4bf", b: "#0d9488", solid: "#0f766e" },
  { id: "flamingo", a: "#fb923c", b: "#f43f5e", solid: "#f43f5e" },
  { id: "azure", a: "#22d3ee", b: "#3b82f6", solid: "#0284c7" },
  { id: "orchid", a: "#e879f9", b: "#d946ef", solid: "#c026d3" },
  { id: "royal", a: "#3b82f6", b: "#1d4ed8", solid: "#2563eb" },
];

/** Looks up a tint by id; unknown ids mean "no tint". */
export function findAppTint(id: string | null | undefined): AppTint | null {
  if (!id) return null;
  return APP_TINTS.find((tint) => tint.id === id) ?? null;
}
