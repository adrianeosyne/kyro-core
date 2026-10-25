import { create } from "zustand";

/**
 * Ephemeral interface state: layout toggles, overlays and drafts.
 * Everything here is either session state or mirrored into localStorage.
 */

export type ThemeChoice = "dark" | "light" | "system";
export type AccentChoice = "default" | "cyan" | "violet" | "emerald" | "rose" | "amber";
export type Density = "comfortable" | "compact";
export type StatusChoice = "online" | "idle" | "dnd" | "invisible" | "offline";

const STORAGE_KEY = "kyro.prefs.v1";

export interface Preferences {
  theme: ThemeChoice;
  accent: AccentChoice;
  density: Density;
  showMemberList: boolean;
}

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  accent: "default",
  density: "comfortable",
  showMemberList: true,
};

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPreferences(prefs: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark =
    prefs.theme === "dark" || (prefs.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.dataset.accent = prefs.accent === "default" ? "" : prefs.accent;
  root.dataset.density = prefs.density;
}

interface AppState extends Preferences {
  mobileNavOpen: boolean;
  memberListOpen: boolean;
  searchOpen: boolean;
  inboxOpen: boolean;
  drafts: Record<string, string>;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setMobileNav: (open: boolean) => void;
  toggleMemberList: () => void;
  setSearchOpen: (open: boolean) => void;
  setInboxOpen: (open: boolean) => void;
  setDraft: (key: string, value: string) => void;
  reset: () => void;
}

const initial = loadPrefs();

export const useUiStore = create<AppState>((set, get) => ({
  ...initial,
  memberListOpen: initial.showMemberList,
  mobileNavOpen: false,
  searchOpen: false,
  inboxOpen: false,
  drafts: {},
  setPreference: (key, value) => {
    const next = { ...get(), [key]: value } as AppState;
    const prefs: Preferences = {
      theme: next.theme,
      accent: next.accent,
      density: next.density,
      showMemberList: next.showMemberList,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable; preferences stay in memory */
    }
    applyPreferences(prefs);
    set({ [key]: value } as Partial<AppState>);
  },
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  toggleMemberList: () =>
    set((state) => {
      const next = !state.memberListOpen;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            theme: state.theme,
            accent: state.accent,
            density: state.density,
            showMemberList: next,
          }),
        );
      } catch {
        /* ignore */
      }
      return { memberListOpen: next };
    }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setInboxOpen: (open) => set({ inboxOpen: open }),
  setDraft: (key, value) =>
    set((state) => ({ drafts: { ...state.drafts, [key]: value } })),
  reset: () =>
    set({ mobileNavOpen: false, searchOpen: false, inboxOpen: false }),
}));

if (typeof window !== "undefined") {
  applyPreferences(initial);
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener?.("change", () => {
      const { theme } = useUiStore.getState();
      if (theme === "system") applyPreferences({ ...loadPrefs(), theme });
    });
}
