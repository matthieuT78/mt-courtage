// pages/admin.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

// Types de base
type SimpleUser = {
  id?: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

type Profile = {
  id: string;
  email: string;
  full_name?: string | null;
  is_admin?: boolean | null;
  created_at?: string;
};

type Project = {
  id: string;
  type: string;
  title?: string | null;
  created_at?: string;
};

type SimStat = {
  type: string;
  count: number;
};

type AppSettings = {
  taux_immo_defaut: number | null;
  frais_notaire_defaut: number | null;
  frais_agence_defaut: number | null;
};

function formatEuro(val: number) {
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default function AdminPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Métriques globales
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalProjects, setTotalProjects] = useState<number | null>(null);

  // Stats simulateurs
  const [simStats, setSimStats] = useState<SimStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Recherche utilisateur
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loadingUserSearch, setLoadingUserSearch] = useState(false);

  // Projets d’un utilisateur sélectionné
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedUserProjects, setSelectedUserProjects] = useState<Project[]>([]);
  const [loadingUserProjects, setLoadingUserProjects] = useState(false);

  // Paramètres globaux
  const [settings, setSettings] = useState<AppSettings>({
    taux_immo_defaut: null,
    frais_notaire_defaut: null,
    frais_agence_defaut: null,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // --------------------- Auth & garde admin ---------------------
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        if (!supabase) {
          setAuthError(
            "Supabase n'est pas configuré côté frontend. Vérifie lib/supabaseClient."
          );
          setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessUser = data.session?.user ?? null;

        if (!sessUser) {
          // Pas connecté → redirection vers login
          setAuthError("Vous devez être connecté pour accéder à l'administration.");
          setIsAdmin(false);
          if (typeof window !== "undefined") {
            window.location.href = "/mon-compte?mode=login&redirect=/admin";
          }
          return;
        }

        if (!isMounted) return;
        setUser(sessUser);

        const email = sessUser.email || "";
        const isAdminEmailMatch =
          ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        if (!isAdminEmailMatch) {
          setAuthError(
            "Accès refusé : ce compte n'est pas autorisé à accéder à l'administration."
          );
          setIsAdmin(false);
          return;
        }

        // ✅ OK admin
        setIsAdmin(true);
        setAuthError(null);

        // Charger les données du dashboard
        await Promise.all([
          loadGlobalMetrics(),
          loadSimStats(),
          loadSettingsFromDb(),
        ]);
      } catch (e: any) {
        console.error("Erreur init admin:", e);
        setAuthError(e?.message || "Erreur inconnue.");
        setIsAdmin(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const loadGlobalMetrics = async () => {
      try {
        // Total users (table "profiles" à adapter si besoin)
        const { count: usersCount, error: usersError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (!usersError) {
          setTotalUsers(usersCount ?? 0);
        }

        // Total projects
        const { count: projCount, error: projError } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true });
        if (!projError) {
          setTotalProjects(projCount ?? 0);
        }
      } catch (e) {
        console.error("Erreur metrics admin:", e);
      }
    };

    const loadSimStats = async () => {
      try {
        setLoadingStats(true);
        const { data, error } = await supabase
          .from("projects")
          .select("type")
          .order("type", { ascending: true });

        if (error) {
          console.error("Erreur stats simulateurs:", error);
          return;
        }

        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const t = row.type || "inconnu";
          counts[t] = (counts[t] || 0) + 1;
        });

        const stats: SimStat[] = Object.entries(counts).map(([type, count]) => ({
          type,
          count,
        }));
        setSimStats(stats);
      } finally {
        setLoadingStats(false);
      }
    };

    const loadSettingsFromDb = async () => {
      try {
        setLoadingSettings(true);
        const { data, error } = await supabase
          .from("app_settings")
          .select("key, value_json");

        if (error) {
          console.warn(
            "Table app_settings absente ou erreur. Les paramètres globaux resteront par défaut.",
            error.message
          );
          return;
        }

        const next: AppSettings = {
          taux_immo_defaut: null,
          frais_notaire_defaut: null,
          frais_agence_defaut: null,
        };

        (data || []).forEach((row: any) => {
          if (row.key === "taux_immo_defaut") {
            next.taux_immo_defaut = Number(row.value_json) || null;
          }
          if (row.key === "frais_notaire_defaut") {
            next.frais_notaire_defaut = Number(row.value_json) || null;
          }
          if (row.key === "frais_agence_defaut") {
            next.frais_agence_defaut = Number(row.value_json) || null;
          }
        });

        setSettings(next);
      } finally {
        setLoadingSettings(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------- Recherche utilisateur ---------------------
  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    setLoadingUserSearch(true);
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedUserProjects([]);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, is_admin, created_at")
        .ilike("email", `%${searchEmail.trim()}%`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur recherche users:", error);
        return;
      }

      setSearchResults((data || []) as Profile[]);
    } finally {
      setLoadingUserSearch(false);
    }
  };

  const handleSelectUser = async (profile: Profile) => {
    setSelectedUser(profile);
    setSelectedUserProjects([]);
    setLoadingUserProjects(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, type, title, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur chargement projets utilisateur:", error);
        return;
      }

      setSelectedUserProjects((data || []) as Project[]);
    } finally {
      setLoadingUserProjects(false);
    }
  };

  // --------------------- Export CSV stats ---------------------
  const handleExportStatsCsv = () => {
    if (!simStats || simStats.length === 0) return;

    const rows = [["simulateur", "nb_projets"]];
    simStats.forEach((s) => {
      rows.push([s.type, s.count.toString()]);
    });

    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `stats_simulateurs_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --------------------- Sauvegarde paramètres globaux ---------------------
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const payload = [
        {
          key: "taux_immo_defaut",
          value_json: settings.taux_immo_defaut,
        },
        {
          key: "frais_notaire_defaut",
          value_json: settings.frais_notaire_defaut,
        },
        {
          key: "frais_agence_defaut",
          value_json: settings.frais_agence_defaut,
        },
      ];

      const { error } = await supabase.from("app_settings").upsert(payload, {
        onConflict: "key",
      });

      if (error) throw error;
      setSettingsMessage("✅ Paramètres globaux enregistrés.");
    } catch (e: any) {
      console.error("Erreur sauvegarde settings:", e);
      setSettingsMessage(
        "❌ Erreur lors de l'enregistrement des paramètres : " +
          (e?.message || "erreur inconnue")
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // --------------------- Rendu ---------------------
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">Chargement de l&apos;admin…</p>
        </main>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white shadow-sm p-5 space-y-2">
            <h1 className="text-base font-semibold text-red-700">
              Accès administration refusé
            </h1>
            <p className="text-sm text-slate-600">
              {authError ||
                "Ce compte n'est pas autorisé à consulter la page d'administration."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Titre / intro */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-1">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
            Administration
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Tableau de bord administrateur
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            Vue globale sur les utilisateurs, les projets et l&apos;usage des
            simulateurs. Accès réservé à l&apos;administrateur ({ADMIN_EMAIL || "non configuré"}).
          </p>
        </section>

        {/* Metrics haut de page */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
              Utilisateurs inscrits
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {totalUsers ?? "-"}
            </p>
            <p className="mt-1 text-[0.75rem] text-slate-500">
              Basé sur la table <code className="font-mono">profiles</code>.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
              Projets enregistrés
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {totalProjects ?? "-"}
            </p>
            <p className="mt-1 text-[0.75rem] text-slate-500">
              Toutes simulations confondues.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
              Compte admin connecté
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {user?.email}
            </p>
            <p className="mt-1 text-[0.75rem] text-slate-500">
              Droits complets sur le tableau de bord.
            </p>
          </div>
        </section>

        {/* Deux colonnes : à gauche users / projets, à droite stats / settings */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Colonne gauche : gestion utilisateurs / projets */}
          <div className="space-y-4">
            {/* Recherche utilisateur */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Utilisateurs
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Rechercher un utilisateur par email
                  </h2>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="ex : prenom.nom@email.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={loadingUserSearch}
                  className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loadingUserSearch ? "Recherche..." : "Chercher"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={
                        "w-full text-left rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 " +
                        (selectedUser?.id === u.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {u.full_name || u.email}
                        </p>
                        <p className="text-[0.7rem] text-slate-600">
                          {u.email}
                        </p>
                      </div>
                      {u.is_admin && (
                        <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                          Admin
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !loadingUserSearch && (
                <p className="text-[0.75rem] text-slate-500">
                  Saisissez une adresse email (ou une partie) puis lancez la
                  recherche.
                </p>
              )}
            </div>

            {/* Projets de l'utilisateur sélectionné */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Projets utilisateur
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Voir tous les projets du compte sélectionné
                  </h2>
                </div>
              </div>

              {!selectedUser && (
                <p className="text-[0.75rem] text-slate-500">
                  Sélectionnez d&apos;abord un utilisateur dans la liste de
                  recherche ci-dessus.
                </p>
              )}

              {selectedUser && (
                <>
                  <p className="text-[0.75rem] text-slate-600">
                    Utilisateur :{" "}
                    <span className="font-semibold">
                      {selectedUser.full_name || selectedUser.email}
                    </span>{" "}
                    ({selectedUser.email})
                  </p>

                  {loadingUserProjects && (
                    <p className="text-[0.75rem] text-slate-500">
                      Chargement des projets…
                    </p>
                  )}

                  {!loadingUserProjects &&
                    selectedUserProjects.length === 0 && (
                      <p className="text-[0.75rem] text-slate-500">
                        Aucun projet enregistré pour cet utilisateur.
                      </p>
                    )}

                  {!loadingUserProjects &&
                    selectedUserProjects.length > 0 && (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {selectedUserProjects.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[0.75rem]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">
                                {p.title || "(sans titre)"}
                              </p>
                              <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-900 text-white">
                                {p.type}
                              </span>
                            </div>
                            <p className="mt-1 text-[0.7rem] text-slate-500">
                              Créé le{" "}
                              {p.created_at
                                ? new Date(
                                    p.created_at
                                  ).toLocaleDateString("fr-FR")
                                : "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}
            </div>
          </div>

          {/* Colonne droite : stats simulateurs + paramètres globaux */}
          <div className="space-y-4">
            {/* Stats simulateurs */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Statistiques
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Usage des simulateurs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleExportStatsCsv}
                  disabled={!simStats.length}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>

              {loadingStats && (
                <p className="text-[0.75rem] text-slate-500">
                  Chargement des statistiques…
                </p>
              )}

              {!loadingStats && simStats.length === 0 && (
                <p className="text-[0.75rem] text-slate-500">
                  Aucune statistique disponible (table{" "}
                  <code className="font-mono">projects</code> vide ou non
                  utilisée).
                </p>
              )}

              {!loadingStats && simStats.length > 0 && (
                <div className="space-y-1">
                  {simStats.map((s) => (
                    <div
                      key={s.type}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[0.8rem]"
                    >
                      <span className="font-medium text-slate-800">
                        {s.type}
                      </span>
                      <span className="text-slate-700">{s.count} projet(s)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paramètres globaux */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Paramètres globaux
                </p>
                <h2 className="text-sm font-semibold text-slate-900">
                  Configurer les valeurs par défaut
                </h2>
                <p className="text-[0.75rem] text-slate-500">
                  Ces paramètres peuvent être utilisés par tes simulateurs
                  (taux, frais) comme valeurs par défaut.
                </p>
              </div>

              {loadingSettings ? (
                <p className="text-[0.75rem] text-slate-500">
                  Chargement des paramètres…
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[0.75rem] text-slate-700">
                      Taux de crédit immo par défaut (% annuel)
                    </label>
                    <input
                      type="number"
                      value={settings.taux_immo_defaut ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          taux_immo_defaut: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.75rem] text-slate-700">
                      Frais de notaire par défaut (%)
                    </label>
                    <input
                      type="number"
                      value={settings.frais_notaire_defaut ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          frais_notaire_defaut: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.75rem] text-slate-700">
                      Frais d&apos;agence par défaut (%)
                    </label>
                    <input
                      type="number"
                      value={settings.frais_agence_defaut ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          frais_agence_defaut: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="mt-2 rounded-full bg-emerald-600 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {savingSettings
                      ? "Enregistrement..."
                      : "Enregistrer les paramètres"}
                  </button>
                  {settingsMessage && (
                    <p className="text-[0.7rem] text-slate-600">
                      {settingsMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils
          administrateur.
        </p>
      </footer>
    </div>
  );
}
