import type { NextApiRequest } from "next";
import { supabaseAdmin } from "./supabaseAdmin";

type AuthResult =
  | { ok: true; userId: string; internal: boolean; email?: string | null; status?: number; error?: string }
  | { ok: false; status: number; error: string };

export async function requireApiUser(req: NextApiRequest, options: { allowInternal?: boolean } = {}): Promise<AuthResult> {
  if (options.allowInternal) {
    const internalSecret = String(req.headers["x-internal-secret"] || "");
    const expected = process.env.INTERNAL_API_SECRET || "";
    if (expected && internalSecret && internalSecret === expected) {
      return { ok: true, userId: "internal", internal: true };
    }
  }

  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Supabase admin non configuré." };
  }

  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return { ok: false, status: 401, error: "Non authentifié (Bearer token manquant)." };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: "Non authentifié (Bearer token invalide)." };
  }

  return { ok: true, userId: data.user.id, email: data.user.email ?? null, internal: false };
}

export function requireMatchingUser(auth: { userId: string; internal: boolean }, userId: string): AuthResult {
  if (auth.internal) return { ok: true, userId, internal: true };
  if (auth.userId !== userId) {
    return { ok: false, status: 403, error: "Accès refusé (user mismatch)." };
  }
  return { ok: true, userId, internal: false };
}
