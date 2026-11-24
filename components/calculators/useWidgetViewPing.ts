import { useEffect } from "react";

// Signale une vue de l'embed (pages/embed/*.tsx) à /api/tools/capacite/
// widget-view — seul signal d'usage qui ne dépend pas d'un consentement
// visiteur (contrairement à lead_count), cf. audit du 2026-11-24. Fire-and-
// forget : ne doit jamais bloquer ni ralentir le rendu du simulateur.
export function useWidgetViewPing(simulator: "capacite" | "pret-relais" | "investissement" | null | undefined, agencyToken?: string) {
  useEffect(() => {
    if (!simulator) return;
    fetch("/api/tools/capacite/widget-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulator, agencyToken: agencyToken || undefined }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator, agencyToken]);
}
