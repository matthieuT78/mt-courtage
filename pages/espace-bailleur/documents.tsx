import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { SectionDocumentsTemplates } from "../../components/landlord/sections/SectionDocumentsTemplates";
import { supabase } from "../../lib/supabaseClient";

type SimpleUser = { id: string; email?: string | null };

export default function DocumentsBailleurPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (!supabase) throw new Error("Supabase indisponible.");
        const { data } = await supabase.auth.getSession();
        const current = data.session?.user;
        if (!current?.id) {
          router.replace(`/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/documents")}`);
          return;
        }

        if (!mounted) return;
        setUser({ id: current.id, email: current.email });

        const [p, t, l] = await Promise.all([
          supabase.from("properties").select("*").eq("user_id", current.id).order("created_at", { ascending: false }),
          supabase.from("tenants").select("*").eq("user_id", current.id).order("created_at", { ascending: false }),
          supabase.from("leases").select("*").eq("user_id", current.id).order("created_at", { ascending: false }),
        ]);

        if (!mounted) return;
        setProperties(Array.isArray(p.data) ? p.data : []);
        setTenants(Array.isArray(t.data) ? t.data : []);
        setLeases(Array.isArray(l.data) ? l.data : []);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {checking ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Chargement…</div>
        ) : user ? (
          <SectionDocumentsTemplates
            userId={user.id}
            userEmail={user.email}
            properties={properties}
            tenants={tenants}
            leases={leases}
          />
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}
