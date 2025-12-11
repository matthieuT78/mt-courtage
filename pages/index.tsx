// pages/admin.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  id?: string;
  email?: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  is_admin: boolean | null;
  created_at?: string | null;
};

type AdminStats = {
  totalUsers: number;
  totalProjects: number;
  byType: { type: string; count: number }[];
};

const ADMIN_EMAILS =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";

const adminEmailsSet = new Set(
  ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmailsSet.has(email.toLowerCase());
}

export default function AdminPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Récupération session + contrôle admin
  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!isMounted) return;
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);

        const email = sessionUser?.email ?? null;
        const isAdminFlag = isAdminEmail(email);
        setIsAdmin(!!isAdminFlag);
      } catch (e) {
        console.error("Erreur récupération session (admin)", e);
        if (isMounted) {
          setError(
            "Erreur lors de la récupération de la session. Réessayez ou contactez l'administrateur."
          );
        }
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    };

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2) Récupération des données admin (profils + stats)
  useEffect(() => {
    if (!isAdmin || !user) return;

    let isMounted = true;
    const loadData = async () => {
      try {
        setLoadingData(true);
        setError(null);

        // a) Profils
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, is_admin, created_at")
          .order("created_at", { ascending: false });

        if (profilesError) throw profilesError;

        // b) Stats projets
        const { data: projectsStats, error: statsError } = await supabase
          .from("projects")
          .select("type", { count: "exact", head: false });

        if (statsError) throw statsError;

        const totalUsers = profilesData?.length ?? 0;
        const totalProjects = projectsStats?.length ?? 0;

        // Regrouper par type
        const byTypeMap = new Map<string, number>();
        (projectsStats || []).forEach((p: any) => {
          const t = p.type || "inconnu";
          byTypeMap.set(t, (byTypeMap.get(t) || 0) + 1);
        });
        const byType: { type: string; count: number }[] = Array.from(
          byTypeMap.entries()
        ).map(([type, count]) => ({ type, count }));

        if (!isMounted) return;
        setProfiles(profilesData || []);
        setStats({
          totalUsers,
          totalProjects,
          byType,
        });
      } catch (e: any) {
        console.error("Erreur chargement données admin :", e);
        if (isMounted) {
          setError(
            "Erreur lors du chargement des données d'administration. Vérifiez la console ou Supabase."
          );
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, user]);

  // --- Rendus d'état ----
  if (loadingUser) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">Chargement de votre session…</p>
        </main>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white shadow-sm p-6 text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-red-500">
              Accès administration refusé
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Accès refusé : ce compte n&apos;est pas autorisé à accéder à
              l&apos;administration.
            </h1>
            <p className="text-sm text-slate-600">
              Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, vérifiez que votre
              adresse email figure bien dans la liste{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-[0.75rem]">
                ADMIN_EMAILS
              </code>{" "}
              ou{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-[0.75rem]">
                NEXT_PUBLIC_ADMIN_EMAILS
              </code>{" "}
              sur Vercel.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // --- Page admin principale ---
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* En-tête */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Administration
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Tableau de bord administrateur
            </h1>
            <p className="text-xs text-slate-600 max-w-xl">
              Vue d&apos;ensemble des utilisateurs, projets et outils de gestion de
              la plateforme.
            </p>
          </div>
          <div className="text-right text-[0.75rem] text-slate-500">
            <p>Connecté en tant que :</p>
            <p className="font-medium text-slate-800">
              {user.email ?? "Email inconnu"}
            </p>
            <p className="text-emerald-600 font-semibold">Administrateur</p>
          </div>
        </section>

        {/* Stats globales */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Synthèse d&apos;activité
            </h2>
            {loadingData && (
              <p className="text-[0.7rem] text-slate-500">
                Actualisation des données…
              </p>
            )}
          </div>

          {error && (
            <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                Utilisateurs
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {stats?.totalUsers ?? 0}
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Comptes présents dans la table <code>profiles</code>.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                Projets
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {stats?.totalProjects ?? 0}
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Tous types confondus (capacite, locatif, relais…).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                Usage par simulateur
              </p>
              <ul className="mt-1 space-y-0.5 text-[0.7rem] text-slate-600">
                {stats?.byType?.length
                  ? stats.byType.map((t) => (
                      <li key={t.type} className="flex justify-between">
                        <span>{t.type}</span>
                        <span className="font-semibold">{t.count}</span>
                      </li>
                    ))
                  : (
                    <li className="text-slate-400">
                      Pas encore de projets enregistrés.
                    </li>
                  )}
              </ul>
            </div>
          </div>
        </section>

        {/* Liste des utilisateurs */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Utilisateurs inscrits
              </h2>
              <p className="text-[0.75rem] text-slate-600">
                Liste des comptes présents dans <code>public.profiles</code>.
              </p>
            </div>
            <p className="text-[0.7rem] text-slate-500">
              Total :{" "}
              <span className="font-semibold">
                {profiles.length}
              </span>
            </p>
          </div>

          {profiles.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun profil trouvé. Vérifiez que vous alimentez bien la table{" "}
              <code>profiles</code> à la création d&apos;un compte (via trigger ou
              RPC).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-left text-[0.8rem]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      ID utilisateur
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      Nom / profil
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      Rôle
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      Créé le
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50/70"
                    >
                      <td className="px-3 py-2 font-mono text-[0.7rem] text-slate-700">
                        {p.id.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {p.full_name || (
                          <span className="text-slate-400 italic">
                            Nom non renseigné
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.is_admin ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-700 border border-emerald-100">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[0.7rem] font-medium text-slate-600 border border-slate-200">
                            Utilisateur
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString("fr-FR")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Outils administrateur (placeholders) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Outils administrateur
          </h2>
          <p className="text-[0.75rem] text-slate-600">
            Zone pour centraliser les actions avancées (à enrichir progressivement).
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
              <p className="text-[0.75rem] font-semibold text-slate-800">
                Voir les projets d&apos;un utilisateur
              </p>
              <p className="text-[0.7rem] text-slate-600">
                Plus tard : sélection d&apos;un utilisateur dans la liste et affichage de
                tous ses projets.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
              <p className="text-[0.75rem] font-semibold text-slate-800">
                Suivi d&apos;usage des simulateurs
              </p>
              <p className="text-[0.7rem] text-slate-600">
                Statistiques plus fines sur chaque simulateur (capacite, locatif,
                relais…).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
              <p className="text-[0.75rem] font-semibold text-slate-800">
                Export CSV / Excel
              </p>
              <p className="text-[0.7rem] text-slate-600">
                Boutons d&apos;export des utilisateurs / projets pour analyse externe.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
              <p className="text-[0.75rem] font-semibold text-slate-800">
                Paramètres globaux
              </p>
              <p className="text-[0.7rem] text-slate-600">
                Taux par défaut, frais de notaire, hypothèses d&apos;IA… stockés dans
                une table <code>settings</code>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils
          d&apos;administration.
        </p>
      </footer>
    </div>
  );
}
