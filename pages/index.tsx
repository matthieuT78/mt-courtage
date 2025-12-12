// pages/mon-compte/index.tsx
import AccountLayout from "../../components/account/AccountLayout";

export default function MonCompteHome() {
  return (
    <AccountLayout title="Tableau de bord">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Accès rapide à votre espace. Choisissez une rubrique dans le menu à gauche.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Bailleurs
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Quittances, biens, locataires
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Configurez vos biens et l’envoi automatique.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Projets
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Simulations sauvegardées
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Retrouvez et partagez vos calculs.
            </p>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
