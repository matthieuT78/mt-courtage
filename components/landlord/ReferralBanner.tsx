import Link from "next/link";
import { GiftIcon } from "@heroicons/react/24/outline";

// Version discrète pour le cockpit — juste de quoi capter l'attention, sans
// le lien/stats/récompense (qui restent dans Mon Compte > Abonnement, voir
// ReferralCard.tsx). Renvoie vers /parrainage pour le détail.
export function ReferralBanner() {
  return (
    <Link
      href="/parrainage"
      className="flex items-center gap-3 rounded-2xl border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-white px-4 py-3 shadow-sm transition hover:border-[#635bff]/30 hover:shadow-md"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#635bff]/10 text-[#635bff]">
        <GiftIcon className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Parrainez un bailleur</span> — 3 mois à −50 % pour vous deux
      </p>
      <span className="shrink-0 text-xs font-semibold text-[#635bff]">Découvrir →</span>
    </Link>
  );
}
