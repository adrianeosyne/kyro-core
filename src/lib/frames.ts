/**
 * Built-in avatar frames — gradient rings drawn around a profile picture.
 *
 * Shared by Convex (validation on save) and the client (editor + renderer),
 * so the id list lives in exactly one place. Class names are written out
 * literally so Tailwind picks them up when scanning this file.
 */
export interface AvatarFrame {
  id: string;
  label: string;
  /** Gradient stops applied as `bg-gradient-to-br ${gradient}` on the ring. */
  gradient: string;
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  { id: "ember", label: "Ember", gradient: "from-amber-300 via-orange-500 to-rose-500" },
  { id: "aqua", label: "Aqua", gradient: "from-sky-300 via-cyan-400 to-blue-500" },
  { id: "forest", label: "Forest", gradient: "from-emerald-300 via-green-400 to-teal-600" },
  { id: "kyro", label: "Kyro", gradient: "from-indigo-400 via-brand to-cyan" },
  { id: "gold", label: "Gold", gradient: "from-yellow-200 via-amber-400 to-orange-500" },
  { id: "rose", label: "Rose", gradient: "from-pink-300 via-rose-400 to-red-500" },
];

/** Looks up a frame by id; unknown ids fall back to a plain avatar. */
export function findFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null;
  return AVATAR_FRAMES.find((frame) => frame.id === id) ?? null;
}
