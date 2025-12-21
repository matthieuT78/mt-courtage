// hooks/useProfile.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  updated_at?: string | null;
};

const buildFullName = (first?: string | null, last?: string | null) =>
  [String(first || "").trim(), String(last || "").trim()].filter(Boolean).join(" ").trim() || null;

export function useProfile(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setError(null);
    setOk(null);

    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      setProfile((data as any) || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le profil.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const save = useCallback(
    async (patch: Partial<Profile>) => {
      if (!supabase || !userId) return;
      setLoading(true);
      setError(null);
      setOk(null);

      try {
        const next = {
          ...patch,
          id: userId,
          full_name: buildFullName(
            patch.first_name ?? profile?.first_name ?? null,
            patch.last_name ?? profile?.last_name ?? null
          ),
          updated_at: new Date().toISOString(),
        };

        // Upsert sur PK id (uuid) : ça crée si absent, update sinon
        const { data, error } = await supabase.from("profiles").upsert(next).select("*").single();
        if (error) throw error;

        setProfile((data as any) || null);
        setOk("Profil mis à jour ✅");
      } catch (e: any) {
        setError(e?.message || "Impossible d’enregistrer.");
      } finally {
        setLoading(false);
      }
    },
    [userId, profile]
  );

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  return { loading, profile, error, ok, load, save, setProfile };
}
