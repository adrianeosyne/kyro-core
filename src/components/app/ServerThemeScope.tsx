import { useQuery } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { applyPreferences, useUiStore } from "@/lib/store";

/**
 * Applies a community's own colours (Settings → Theme) while you're inside
 * it — only for viewers who left "Use a server's own colours" on in
 * Appearance. Unmounting restores the personal tint exactly as it was.
 */
export function ServerThemeScope({
  serverId,
  children,
}: {
  serverId: Id<"servers">;
  children: ReactNode;
}) {
  const useServerColours = useUiStore((state) => state.useServerColours);
  const server = useQuery(api.servers.get, { serverId });
  const accent = server?.themeAccent ?? null;
  const tint = server?.themeTint ?? null;

  useEffect(() => {
    const root = document.documentElement;
    if (!useServerColours || (!accent && !tint)) {
      applyPreferences(useUiStore.getState());
      return;
    }
    if (accent) {
      root.style.setProperty("--primary", accent);
      root.style.setProperty("--brand", accent);
      root.style.setProperty(
        "--ring",
        `color-mix(in oklab, ${accent} 60%, transparent)`,
      );
      root.style.setProperty("--sidebar-primary", accent);
    }
    if (tint) {
      root.style.setProperty("--tint-a", tint);
      root.style.setProperty("--tint-b", tint);
      root.style.setProperty("--tint-strength", "9%");
      root.dataset.tint = `server:${serverId}`;
    }
    return () => applyPreferences(useUiStore.getState());
  }, [useServerColours, accent, tint, serverId]);

  return <>{children}</>;
}
