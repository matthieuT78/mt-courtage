// pages/admin.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";
import { isAdminEmail } from "../lib/authHelpers";

type SimpleUser = {
  id?: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
};

type AdminStats = {
  userCount: number | null;
  projectCount: number | null;
  lastUsers: { id: string; email: string | null; created_at: string }[];
  lastProjects: {
    id: string;
    type: string | null;
    title: string | null;
    created_at: string;
  }[];
};

export default function AdminPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    userCount: null,
    projectCount: null,
    lastUsers: [],
    lastProjects: [],
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  // 1) Récupérer la session
  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!isMounted) return;
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser as any);
      } catch (e) {
        console.error("Erreur récupération session (admin)", e);
        if (isMounted) setError("Impossible de récupérer votre session.");
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const isAdmin = !!user && isAdminEmail(user.email ?? null);

  // 2) Charger les stats quand on sait que c'est un admin
  useEffect(() => {
    if (!supabase) return;
    if (!user) return;
    if (!isAdmin) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      setError(null);
      try {
        // 👉 NB : adapte les noms de tables à ton schéma
        // On suppose :
        // - une table "profiles" (1 ligne par user)
        // - une table "projects" (tu l'utilises déjà)

        // Nombre d'utilisateurs (table profiles)
        const { count: userCount, error: userCountError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        if (userCountError) throw userCountError;

        // Nombre de projets
        const { count: projectCount, error: projectCountError } =
          await supabase
            .from("projects")
            .select("*", { count: "exact", head: true });

        if (projectCountError) throw projectCountError;

        // Derniers utilisateurs (si tu as une vue/ table "profiles" avec created_at)
        const { data: lastUsersData, error: lastUsersError } = await supabase
          .from("profiles")
          .select("id, email, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (lastUsersError) throw lastUsersError;

        // Derniers projets
        const { data: lastProjectsData, error: lastProjectsError } =
          await supabase
            .from("projects")
            .select("id, type, title, created_at")
            .order("created_at", { ascending: false })
            .limit(5);

        if (lastProjectsError) throw lastProjectsError;

        setStats({
          userCount: userCount ?? 0,
          projectCount: projectCount ?? 0,
          lastUsers: lastUsersData || [],
          lastProjects: lastProjectsData || [],
        });
      } catch (e: any) {
        console.error("Erreur chargement stats admin :", e);
        setError(
          e?.message || "Erreur inattendue lors du chargement des statistiques."
        );
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user, isAdmin]);

  // 3) Redirection vers login si pas connecté
  useEffect(() => {
    if (loadingUser) return;
    if (!user && typeof window !== "undefined") {
      window.location.href = "/mon-compte?mode=login&redirect=/admin";
    }
  }, [loadingUser, user]);

  // --- Rendu ---
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

  if (!user) {
    // On a déjà déclenché la redirection, on met juste un fallback
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-5 text-center max-w-sm">
            <p className="text-sm font-semibold text-slate-900">
              Accès administrateur uniquement
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Ce tableau de bord est réservé à l&apos;administrateur du site.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header admin */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">
                Tableau de bord admin
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                Bonjour {displayName || "admin"}, vous avez le contrôle.
              </h1>
              <p className="text-xs text-slate-600 max-w-xl mt-1">
                Vue d&apos;ensemble des utilisateurs, des projets et de l&apos;activité
                sur vos simulateurs. Cette page n&apos;est visible que par vous.
              </p>
            </div>
            <div className="text-right text-[0.7rem] text-slate-500">
              <p className="font-mono">
                {user.email}
              </p>
              <p>Rôle : admin</p>
            </div>
          </section>

          {/* Cartes de stats */}
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
                Utilisateurs inscrits
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stats.userCount ?? "—"}
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Basé sur la table <span className="font-mono">profiles</span>.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
                Projets sauvegardés
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stats.projectCount ?? "—"}
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Tous types confondus (capacite, locatif, prêt relais…).
              </p>
            </div>

            {/* Slots pour futures stats */}
            <div className="rounded-2xl bg-white border border-dashed border-slate-200 px-4 py-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                À venir
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Conversion comptes / projets
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                % d&apos;utilisateurs inscrits ayant au moins 1 projet sauvegardé.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-dashed border-slate-200 px-4 py-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                À venir
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Activité récente
              </p>
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Nombre de simulations sur les 7 derniers jours.
              </p>
            </div>
          </section>

          {/* Listes récentes */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Derniers utilisateurs inscrits
                </h2>
                <span className="text-[0.7rem] text-slate-500">
                  {loadingStats ? "Chargement..." : ""}
                </span>
              </div>
              {stats.lastUsers.length === 0 ? (
                <p className="text-[0.8rem] text-slate-500">
                  Aucun utilisateur trouvé (ou table profiles vide).
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.lastUsers.map((u) => (
                    <li key={u.id} className="py-2 flex flex-col">
                      <p className="text-sm text-slate-900">
                        {u.email || "Sans email"}
                      </p>
                      <p className="text-[0.7rem] text-slate-500">
                        Inscrit le{" "}
                        {new Date(u.created_at).toLocaleString("fr-FR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Derniers projets créés
                </h2>
                <span className="text-[0.7rem] text-slate-500">
                  {loadingStats ? "Chargement..." : ""}
                </span>
              </div>
              {stats.lastProjects.length === 0 ? (
                <p className="text-[0.8rem] text-slate-500">
                  Aucun projet enregistré pour le moment.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.lastProjects.map((p) => (
                    <li key={p.id} className="py-2">
                      <p className="text-sm text-slate-900">
                        {p.title || "Sans titre"}
                      </p>
                      <p className="text-[0.7rem] text-slate-500">
                        Type : <span className="font-mono">{p.type}</span> –{" "}
                        {new Date(p.created_at).toLocaleString("fr-FR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Zone "outils admin" à étendre */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              Outils administrateur (à enrichir)
            </h2>
            <p className="text-[0.8rem] text-slate-600 mb-3">
              Idées à ajouter ici :
            </p>
            <ul className="list-disc pl-5 text-[0.8rem] text-slate-600 space-y-1">
              <li>Filtrer / chercher un utilisateur par email.</li>
              <li>Voir tous les projets d&apos;un utilisateur donné.</li>
              <li>Suivre l&apos;usage de chaque simulateur (capacite, locatif, relais…).</li>
              <li>Exporter les stats (CSV / Excel).</li>
              <li>Configurer des paramètres globaux (taux par défaut, frais de notaire…).</li>
            </ul>
          </section>

          {error && (
            <p className="text-[0.8rem] text-red-600">
              Erreur : {error}
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Back-office
          admin.
        </p>
      </footer>
    </div>
  );
}
