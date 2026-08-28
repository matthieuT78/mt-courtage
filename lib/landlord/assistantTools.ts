// lib/landlord/assistantTools.ts
//
// Registre des actions que l'assistant IA du cockpit bailleur peut proposer.
// Chaque outil qui écrit en base réutilise la logique de validation déjà en
// place (routes API existantes, fonctions de gating par plan) au lieu de la
// redéfinir — voir le plan d'implémentation pour le détail de ce choix.
import { supabaseAdmin } from "../supabaseAdmin";
import { getServerUserPlan } from "../serverPermissions";
import { landlordMaxActiveProperties } from "../permissions";
import { getLeaseRentPeriod } from "../rentPeriod";
import { LMNP_REQUIRED_ITEMS, getLmnpItemStatus, propertyRequiresLmnpInventory, lotRequiresLmnpInventory } from "./lmnpInventory";

export type AssistantToolContext = {
  userId: string;
  bearerToken: string;
  baseUrl: string;
};

export type AssistantTool = {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  // Un outil "mutates" ne s'exécute jamais directement depuis le tool_use de
  // Claude : la route de chat renvoie d'abord une carte de confirmation, et
  // ne rappelle execute() qu'après un clic explicite côté utilisateur.
  mutates: boolean;
  // Un outil "navigate" n'écrit rien : il s'exécute tout de suite (comme une
  // lecture) et son résultat inclut un champ "navigation" que la route de
  // chat remonte au front pour afficher un bouton "Ouvrir" qui déclenche une
  // vraie navigation dans le cockpit (deep-link), au lieu de faire agir
  // l'assistant sur des écrans complexes/sensibles (contrat de bail, EDL...).
  navigate?: boolean;
  execute: (ctx: AssistantToolContext, args: Record<string, any>) => Promise<Record<string, any>>;
  // Résumé lisible affiché sur la carte de confirmation, indépendant de la
  // phrase écrite par Claude : résout les ids (bien, lot, locataire, bail) en
  // noms réels plutôt que de faire confiance à la formulation du modèle.
  summarize?: (ctx: AssistantToolContext, args: Record<string, any>) => Promise<Array<{ label: string; value: string }>>;
};

async function callInternalApi(ctx: AssistantToolContext, path: string, body: Record<string, any>) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bearerToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erreur lors de l'appel à ${path}.`);
  return data;
}

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  return supabaseAdmin;
}

const PROPERTY_TYPE_ENUM = ["apartment", "house", "building", "garage", "parking", "other"];
const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: "Appartement",
  house: "Maison",
  building: "Immeuble (plusieurs lots)",
  garage: "Garage",
  parking: "Parking",
  other: "Autre",
};

function euro(n: unknown) {
  const value = Number(n || 0);
  return `${value.toLocaleString("fr-FR")} €`;
}

async function resolvePropertyLabel(admin: NonNullable<typeof supabaseAdmin>, userId: string, propertyId?: string | null, lotId?: string | null) {
  if (!propertyId) return "—";
  const { data: property } = await admin.from("properties").select("label").eq("id", propertyId).eq("user_id", userId).maybeSingle();
  if (!property) return "—";
  let label = property.label || "Bien";
  if (lotId) {
    const { data: lot } = await admin.from("property_lots").select("label").eq("id", lotId).eq("user_id", userId).maybeSingle();
    if (lot?.label) label += ` — ${lot.label}`;
  }
  return label;
}

async function resolveTenantName(admin: NonNullable<typeof supabaseAdmin>, userId: string, tenantId?: string | null) {
  if (!tenantId) return "—";
  const { data: tenant } = await admin.from("tenants").select("full_name").eq("id", tenantId).eq("user_id", userId).maybeSingle();
  return tenant?.full_name || "—";
}

async function resolveLeaseSummary(admin: NonNullable<typeof supabaseAdmin>, userId: string, leaseId?: string | null) {
  if (!leaseId) return null;
  const { data: lease } = await admin.from("leases").select("property_id,lot_id,tenant_id").eq("id", leaseId).eq("user_id", userId).maybeSingle();
  if (!lease) return null;
  const [propertyLabel, tenantName] = await Promise.all([
    resolvePropertyLabel(admin, userId, lease.property_id, lease.lot_id),
    resolveTenantName(admin, userId, lease.tenant_id),
  ]);
  return { propertyLabel, tenantName };
}

export const assistantTools: AssistantTool[] = [
  {
    name: "list_properties",
    description: "Liste les biens du compte (id, libellé, type, adresse, ville, statut). À utiliser pour retrouver l'id d'un bien mentionné par son nom ou son adresse avant toute autre action.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    execute: async (ctx) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("properties")
        .select("id,label,type,address_line1,city,status")
        .eq("user_id", ctx.userId)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { properties: data || [] };
    },
  },
  {
    name: "list_lots",
    description: "Liste les lots d'un immeuble (bien de type 'building'). Nécessaire avant de créer un bail ou une annonce sur un immeuble à plusieurs lots.",
    input_schema: {
      type: "object",
      properties: { property_id: { type: "string", description: "Id du bien immeuble (obtenu via list_properties)." } },
      required: ["property_id"],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("property_lots")
        .select("id,label,surface_m2,status")
        .eq("user_id", ctx.userId)
        .eq("property_id", String(args.property_id))
        .neq("status", "archived")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return { lots: data || [] };
    },
  },
  {
    name: "list_tenants",
    description: "Liste les locataires du compte (id, nom, email). À utiliser pour retrouver l'id d'un locataire mentionné par son nom avant de créer un bail.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    execute: async (ctx) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("tenants")
        .select("id,full_name,email")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { tenants: data || [] };
    },
  },
  {
    name: "list_leases",
    description: "Liste les baux du compte avec le bien et le locataire associés. Utile pour retrouver le lease_id d'un bail existant (ex. avant de générer une quittance ou relancer un impayé).",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["active", "ended"], description: "Filtre optionnel sur le statut du bail." } },
      required: [],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      let query = admin
        .from("leases")
        .select("id,status,property_id,lot_id,tenant_id,rent_amount,charges_amount,start_date,end_date")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false });
      if (args.status) query = query.eq("status", String(args.status));
      const { data: leases, error } = await query;
      if (error) throw new Error(error.message);
      const propertyIds = Array.from(new Set((leases || []).map((l: any) => l.property_id).filter(Boolean)));
      const tenantIds = Array.from(new Set((leases || []).map((l: any) => l.tenant_id).filter(Boolean)));
      const [{ data: properties }, { data: tenants }] = await Promise.all([
        propertyIds.length
          ? admin.from("properties").select("id,label").eq("user_id", ctx.userId).in("id", propertyIds)
          : Promise.resolve({ data: [] as any[] }),
        tenantIds.length
          ? admin.from("tenants").select("id,full_name").eq("user_id", ctx.userId).in("id", tenantIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const propertyById = new Map((properties || []).map((p: any) => [p.id, p.label]));
      const tenantById = new Map((tenants || []).map((t: any) => [t.id, t.full_name]));
      return {
        leases: (leases || []).map((l: any) => ({
          ...l,
          property_label: propertyById.get(l.property_id) || null,
          tenant_name: tenantById.get(l.tenant_id) || null,
        })),
      };
    },
  },
  {
    name: "list_rent_payments",
    description: "Donne le statut de paiement du loyer d'un bail pour un ou plusieurs mois : payé (avec date et montant) ou non encore payé (avec l'échéance attendue). À utiliser pour répondre directement à 'est-ce que X a payé son loyer ?' — ne redirige jamais cette question vers open_quittances.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_month: { type: "string", description: "Mois à vérifier, format YYYY-MM. Par défaut le mois en cours (voir la date du jour donnée en instructions)." },
        months: { type: "number", description: "Nombre de mois à vérifier en remontant depuis period_month, 1 par défaut (max 12)." },
      },
      required: ["lease_id"],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin
        .from("leases")
        .select("id,start_date,end_date,rent_amount,charges_amount")
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");

      const monthsCount = Math.min(12, Math.max(1, Number(args.months) || 1));
      const baseMonth = /^\d{4}-\d{2}$/.test(String(args.period_month || "")) ? String(args.period_month) : new Date().toISOString().slice(0, 7);
      const [baseYear, baseMonthNum] = baseMonth.split("-").map(Number);
      const months = Array.from({ length: monthsCount }, (_, i) => {
        const d = new Date(Date.UTC(baseYear, baseMonthNum - 1 - i, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      });

      const periods = months.map((m) => getLeaseRentPeriod(lease, m)).filter((p): p is NonNullable<typeof p> => !!p);
      if (periods.length === 0) return { payments: [] };

      const { data: paymentsRows } = await admin
        .from("rent_payments")
        .select("period_start,period_end,paid_at,total_amount,payment_method")
        .eq("lease_id", args.lease_id)
        .in("period_start", periods.map((p) => p.periodStart));
      const byStart = new Map((paymentsRows || []).map((row: any) => [row.period_start, row]));

      return {
        payments: periods.map((p) => {
          const row = byStart.get(p.periodStart) as any;
          return {
            period_start: p.periodStart,
            period_end: p.periodEnd,
            expected_amount: p.total,
            paid: !!row?.paid_at,
            paid_at: row?.paid_at || null,
            paid_amount: row?.total_amount ?? null,
            payment_method: row?.payment_method || null,
          };
        }),
      };
    },
  },
  {
    name: "create_property",
    description: "Crée un nouveau bien. Pour un immeuble à plusieurs lots (type='building'), fournir la liste des lots dans 'lots' : chacun sera créé rattaché à l'immeuble. Action irréversible sans suppression manuelle ensuite : nécessite confirmation.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: PROPERTY_TYPE_ENUM, description: "Type de bien." },
        label: { type: "string", description: "Nom donné au bien (ex. 'Studio rue de Paris')." },
        address_line1: { type: "string" },
        postal_code: { type: "string" },
        city: { type: "string" },
        surface_m2: { type: "number", description: "Surface en m², sans objet pour un immeuble (les lots ont leur propre surface)." },
        rooms: { type: "number" },
        lots: {
          type: "array",
          description: "Uniquement si type='building' : un ou plusieurs lots à créer.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              surface_m2: { type: "number" },
              rooms: { type: "number" },
            },
            required: ["label"],
          },
        },
      },
      required: ["type", "label", "address_line1"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const plan = await getServerUserPlan(ctx.userId);
      const { count, error: countError } = await admin
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .neq("status", "archived");
      if (countError) throw new Error(countError.message);
      const maxActiveProperties = landlordMaxActiveProperties(plan);
      if ((count || 0) >= maxActiveProperties) {
        throw new Error(`Limite de biens atteinte pour votre abonnement (${maxActiveProperties} bien(s) actif(s) maximum). Passez à un plan supérieur pour en ajouter un de plus.`);
      }

      const payload = {
        user_id: ctx.userId,
        type: String(args.type),
        label: String(args.label || "").trim(),
        address_line1: String(args.address_line1 || "").trim(),
        postal_code: args.postal_code ? String(args.postal_code).trim() : null,
        city: args.city ? String(args.city).trim() : null,
        surface_m2: args.surface_m2 != null ? Number(args.surface_m2) : null,
        rooms: args.rooms != null ? Number(args.rooms) : null,
        status: "active",
      };
      const { data: property, error } = await admin.from("properties").insert(payload).select("id,label").single();
      if (error) throw new Error(error.message);

      let createdLots: Array<{ id: string; label: string }> = [];
      if (args.type === "building" && Array.isArray(args.lots) && args.lots.length > 0) {
        const lotsPayload = args.lots.map((lot: any, index: number) => ({
          property_id: property.id,
          user_id: ctx.userId,
          label: String(lot.label || `Lot ${index + 1}`).trim(),
          surface_m2: lot.surface_m2 != null ? Number(lot.surface_m2) : null,
          rooms: lot.rooms != null ? Number(lot.rooms) : null,
          sort_order: index,
        }));
        const { data: lots, error: lotsError } = await admin.from("property_lots").insert(lotsPayload).select("id,label");
        if (lotsError) throw new Error(lotsError.message);
        createdLots = lots || [];
      }

      return { property_id: property.id, label: property.label, lots: createdLots };
    },
    summarize: async (_ctx, args) => {
      const rows = [
        { label: "Type", value: PROPERTY_TYPE_LABEL[String(args.type)] || String(args.type || "—") },
        { label: "Nom", value: String(args.label || "—") },
        { label: "Adresse", value: [args.address_line1, args.postal_code, args.city].filter(Boolean).join(", ") || "—" },
      ];
      if (Array.isArray(args.lots) && args.lots.length > 0) {
        rows.push({ label: "Lots", value: args.lots.map((lot: any) => lot.label).filter(Boolean).join(", ") });
      }
      return rows;
    },
  },
  {
    name: "create_tenant",
    description: "Crée une fiche locataire minimale (nom, email, téléphone). Nécessaire avant de créer un bail si le locataire n'existe pas encore.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["full_name"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const payload = {
        user_id: ctx.userId,
        full_name: String(args.full_name || "").trim(),
        email: args.email ? String(args.email).trim() : null,
        phone: args.phone ? String(args.phone).trim() : null,
      };
      const { data, error } = await admin.from("tenants").insert(payload).select("id,full_name").single();
      if (error) throw new Error(error.message);
      return { tenant_id: data.id, full_name: data.full_name };
    },
    summarize: async (_ctx, args) => [
      { label: "Nom", value: String(args.full_name || "—") },
      { label: "Email", value: args.email ? String(args.email) : "—" },
      { label: "Téléphone", value: args.phone ? String(args.phone) : "—" },
    ],
  },
  {
    name: "create_lease",
    description: "Crée un bail entre un bien (ou un lot d'immeuble) et un locataire. Pour un immeuble, lot_id est obligatoire. Toutes les règles existantes s'appliquent (un seul bail actif par lot, limite de baux actifs selon le plan).",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string" },
        lot_id: { type: "string", description: "Obligatoire si le bien est un immeuble (type='building')." },
        tenant_id: { type: "string" },
        start_date: { type: "string", description: "Date de début au format YYYY-MM-DD." },
        rent_amount: { type: "number" },
        charges_amount: { type: "number" },
        deposit_amount: { type: "number" },
        payment_day: { type: "number", description: "Jour du mois d'échéance du loyer, 1-28." },
        lease_kind: {
          type: "string",
          enum: ["furnished_primary", "furnished_student", "mobility", "empty_primary", "professional", "other"],
          description: "Type de location. Demande-le explicitement si ce n'est pas clair (meublé résidence principale, meublé étudiant, mobilité, nu résidence principale, professionnel, autre) : ne suppose jamais 'meublé' par défaut.",
        },
      },
      required: ["property_id", "tenant_id", "start_date", "rent_amount", "lease_kind"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const payload: Record<string, any> = {
        property_id: args.property_id,
        lot_id: args.lot_id || null,
        tenant_id: args.tenant_id,
        start_date: args.start_date,
        rent_amount: Number(args.rent_amount),
        charges_amount: args.charges_amount != null ? Number(args.charges_amount) : 0,
        deposit_amount: args.deposit_amount != null ? Number(args.deposit_amount) : null,
        payment_day: args.payment_day != null ? Number(args.payment_day) : 1,
        lease_kind: args.lease_kind || "furnished_primary",
        status: "active",
      };
      const data = await callInternalApi(ctx, "/api/landlord/leases", { userId: ctx.userId, payload });
      const leaseId = data?.id;
      const isFurnished = ["furnished_primary", "furnished_student", "mobility"].includes(String(payload.lease_kind));
      const nextSteps: Array<{ section: string; link: Record<string, any>; label: string }> = [];
      if (leaseId) {
        nextSteps.push({
          section: "baux",
          link: { leaseId, openContract: true },
          label: "Créer ou importer le contrat de bail",
        });
        nextSteps.push({
          section: "etat_des_lieux",
          link: { leaseId },
          label: "Faire l'état des lieux d'entrée",
        });
        if (isFurnished) {
          nextSteps.push({
            section: "inventaire",
            link: { propertyId: args.property_id, lotId: args.lot_id || undefined },
            label: "Vérifier l'inventaire LMNP de ce logement",
          });
        }
      }
      return { ...data, next_steps: nextSteps };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const [propertyLabel, tenantName] = await Promise.all([
        resolvePropertyLabel(admin, ctx.userId, args.property_id, args.lot_id),
        resolveTenantName(admin, ctx.userId, args.tenant_id),
      ]);
      const rows = [
        { label: "Bien", value: propertyLabel },
        { label: "Locataire", value: tenantName },
        { label: "Début", value: String(args.start_date || "—") },
        { label: "Loyer", value: euro(args.rent_amount) + (args.charges_amount ? ` + ${euro(args.charges_amount)} charges` : "") },
      ];
      if (args.deposit_amount != null) rows.push({ label: "Dépôt", value: euro(args.deposit_amount) });
      return rows;
    },
  },
  {
    name: "confirm_payment",
    description: "Confirme qu'un loyer a été reçu pour un bail et une période donnés. C'est l'action à utiliser quand l'utilisateur dit qu'un locataire a payé ou demande une quittance : confirmer le paiement génère automatiquement la quittance PDF dans la foulée (exactement comme le bouton 'Confirmer le paiement' de l'écran Quittances) — il n'existe pas d'action séparée pour 'juste générer' une quittance sans paiement confirmé.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_start: { type: "string", description: "YYYY-MM-DD" },
        period_end: { type: "string", description: "YYYY-MM-DD" },
        payment_method: { type: "string", description: "Optionnel : mode de paiement si différent de celui du bail." },
      },
      required: ["lease_id", "period_start", "period_end"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const confirmData = await callInternalApi(ctx, "/api/payments/confirm", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        periodStart: args.period_start,
        periodEnd: args.period_end,
        ...(args.payment_method ? { paymentMethodOverride: args.payment_method } : {}),
      });

      const { data: lease } = await admin.from("leases").select("receipts_disabled").eq("id", args.lease_id).eq("user_id", ctx.userId).maybeSingle();
      let receiptGenerated = false;
      if (!lease?.receipts_disabled) {
        try {
          await callInternalApi(ctx, "/api/receipts/generate", {
            userId: ctx.userId,
            leaseId: args.lease_id,
            periodStart: args.period_start,
            periodEnd: args.period_end,
          });
          receiptGenerated = true;
        } catch {
          // Le paiement reste confirmé même si la génération PDF échoue ponctuellement
          // (ex. service PDF indisponible) — l'utilisateur pourra régénérer depuis l'écran Quittances.
        }
      }

      return {
        ...confirmData,
        receipt_generated: receiptGenerated,
        next_steps: [{ section: "quittances", link: {}, label: "Voir la quittance dans Quittances" }],
      };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      rows.push({ label: "Période", value: `${args.period_start || "—"} → ${args.period_end || "—"}` });
      return rows;
    },
  },
  {
    name: "open_quittances",
    description: "Ouvre l'écran Quittances. À utiliser quand l'utilisateur veut voir/gérer ses quittances lui-même plutôt que de confirmer un paiement précis via confirm_payment.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    navigate: true,
    execute: async () => ({
      navigation: { section: "quittances", link: {}, label: "Ouvrir les quittances" },
    }),
  },
  {
    name: "preview_payment_reminder",
    description: "Prépare (sans envoyer) le contenu d'une relance de loyer impayé ou partiel pour un bail et une période donnés : montant manquant, canaux disponibles, texte proposé. À appeler avant send_payment_reminder pour montrer le message à l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_start: { type: "string" },
        period_end: { type: "string" },
        reason: { type: "string", enum: ["unpaid", "partial"] },
      },
      required: ["lease_id", "period_start", "period_end"],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/payments/reminder", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        periodStart: args.period_start,
        periodEnd: args.period_end,
        reason: args.reason || "unpaid",
        action: "preview",
      });
      return data;
    },
  },
  {
    name: "send_payment_reminder",
    description: "Envoie une relance de loyer impayé/partiel au locataire. Toujours appeler preview_payment_reminder juste avant pour connaître le texte et les canaux disponibles.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_start: { type: "string" },
        period_end: { type: "string" },
        reason: { type: "string", enum: ["unpaid", "partial"] },
        channels: { type: "array", items: { type: "string", enum: ["email", "messaging"] } },
        body: { type: "string", description: "Texte du message, obtenu via preview_payment_reminder (éventuellement ajusté à la demande de l'utilisateur)." },
      },
      required: ["lease_id", "period_start", "period_end", "body"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/payments/reminder", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        periodStart: args.period_start,
        periodEnd: args.period_end,
        reason: args.reason || "unpaid",
        channels: Array.isArray(args.channels) && args.channels.length ? args.channels : ["email"],
        body: args.body,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
      }
      rows.push({ label: "Période", value: `${args.period_start || "—"} → ${args.period_end || "—"}` });
      rows.push({ label: "Canaux", value: Array.isArray(args.channels) && args.channels.length ? args.channels.join(", ") : "email" });
      if (args.body) rows.push({ label: "Message", value: String(args.body) });
      return rows;
    },
  },
  {
    name: "create_listing",
    description: "Aide à trouver un locataire pour un bien (ou un lot d'immeuble) en publiant une annonce afin de recevoir des candidatures. À utiliser quand l'utilisateur veut chercher/trouver un locataire, pas seulement quand il dit explicitement 'publier une annonce'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        address: { type: "string", description: "Adresse affichée sur l'annonce (par défaut, celle du bien)." },
        property_id: { type: "string" },
        lot_id: { type: "string", description: "Obligatoire si le bien est un immeuble." },
        rent_amount: { type: "number" },
        charges_amount: { type: "number" },
        property_type: { type: "string" },
        surface_m2: { type: "number" },
        available_at: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["title", "property_id", "rent_amount"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/candidature/create-listing", {
        title: args.title,
        address: args.address || "",
        property_id: args.property_id,
        lot_id: args.lot_id || null,
        rent_amount: Number(args.rent_amount),
        charges_amount: args.charges_amount != null ? Number(args.charges_amount) : 0,
        property_type: args.property_type || null,
        surface_m2: args.surface_m2 != null ? Number(args.surface_m2) : null,
        available_at: args.available_at || null,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const propertyLabel = await resolvePropertyLabel(admin, ctx.userId, args.property_id, args.lot_id);
      return [
        { label: "Titre", value: String(args.title || "—") },
        { label: "Bien", value: propertyLabel },
        { label: "Loyer", value: euro(args.rent_amount) + (args.charges_amount ? ` + ${euro(args.charges_amount)} charges` : "") },
      ];
    },
  },
  {
    name: "open_lease_contract",
    description: "Ouvre l'assistant de contrat de bail (génération PDF ou import d'un contrat existant, mentions légales, signature) pour un bail déjà créé. À proposer systématiquement après la création d'un bail, ou si l'utilisateur demande à créer/importer un contrat.",
    input_schema: {
      type: "object",
      properties: { lease_id: { type: "string" } },
      required: ["lease_id"],
    },
    mutates: false,
    navigate: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin.from("leases").select("id").eq("id", args.lease_id).eq("user_id", ctx.userId).maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");
      return {
        navigation: {
          section: "baux",
          link: { leaseId: args.lease_id, openContract: true },
          label: "Créer ou importer le contrat de bail",
        },
      };
    },
  },
  {
    name: "open_etat_des_lieux",
    description: "Ouvre la section état des lieux pour un bail déjà créé, prêt à réaliser l'état des lieux d'entrée ou de sortie. À proposer après la création d'un bail, ou si l'utilisateur demande à faire un état des lieux.",
    input_schema: {
      type: "object",
      properties: { lease_id: { type: "string" } },
      required: ["lease_id"],
    },
    mutates: false,
    navigate: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin.from("leases").select("id").eq("id", args.lease_id).eq("user_id", ctx.userId).maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");
      return {
        navigation: {
          section: "etat_des_lieux",
          link: { leaseId: args.lease_id },
          label: "Ouvrir l'état des lieux pour ce bail",
        },
      };
    },
  },
  {
    name: "list_lmnp_inventory_status",
    description: "Liste UNIQUEMENT les biens/lots éligibles à l'inventaire LMNP (bail meublé actif — furnished_primary, furnished_student ou mobility ; jamais un bien loué nu), avec pour chacun le % de conformité et le détail des éléments obligatoires manquants ou en quantité insuffisante. Appelle-le AVANT de proposer une liste de biens pour une question d'inventaire LMNP : ne propose jamais un bien non meublé, et donne directement le détail de ce qui manque plutôt que de renvoyer l'utilisateur voir l'écran lui-même.",
    input_schema: {
      type: "object",
      properties: { property_id: { type: "string", description: "Optionnel : limite le résultat à un seul bien (utile une fois le bien identifié)." } },
      required: [],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const [{ data: properties, error: propErr }, { data: lots, error: lotsErr }, { data: leases, error: leasesErr }] = await Promise.all([
        admin.from("properties").select("id,label,type,delegated_services,status").eq("user_id", ctx.userId).neq("status", "archived"),
        admin.from("property_lots").select("id,label,property_id,status").eq("user_id", ctx.userId).neq("status", "archived"),
        admin.from("leases").select("id,property_id,lot_id,status,lease_kind").eq("user_id", ctx.userId),
      ]);
      if (propErr) throw new Error(propErr.message);
      if (lotsErr) throw new Error(lotsErr.message);
      if (leasesErr) throw new Error(leasesErr.message);

      const allProperties = properties || [];
      const allLots = lots || [];
      const allLeases = leases || [];

      type Target = { property_id: string; lot_id: string | null; label: string };
      const targets: Target[] = [];
      for (const property of allProperties) {
        if (args.property_id && property.id !== String(args.property_id)) continue;
        if (property.type === "building") {
          const lotsForProperty = allLots.filter((l: any) => l.property_id === property.id);
          for (const lot of lotsForProperty) {
            if (lotRequiresLmnpInventory(lot.id, allLeases)) {
              targets.push({ property_id: property.id, lot_id: lot.id, label: `${property.label} — ${lot.label}` });
            }
          }
        } else if (propertyRequiresLmnpInventory(property.id, allLeases, allProperties)) {
          targets.push({ property_id: property.id, lot_id: null, label: property.label });
        }
      }

      if (targets.length === 0) {
        return { eligible_properties: [], note: "Aucun bien meublé actif (bail furnished_primary/furnished_student/mobility) — l'inventaire LMNP ne s'applique à aucun bien pour l'instant." };
      }

      const results = await Promise.all(
        targets.map(async (target) => {
          let query = admin
            .from("property_inventory_items")
            .select("label,is_required_lmnp,actual_quantity,required_quantity,condition")
            .eq("user_id", ctx.userId)
            .eq("property_id", target.property_id);
          query = target.lot_id ? query.eq("lot_id", target.lot_id) : query.is("lot_id", null);
          const { data: items, error } = await query;
          if (error) throw new Error(error.message);

          const required = (items || []).filter((i: any) => i.is_required_lmnp);
          const requiredLabels = new Set(required.map((i: any) => String(i.label).trim().toLowerCase()));
          const neverTracked = LMNP_REQUIRED_ITEMS.filter((canonical) => !requiredLabels.has(canonical.label.toLowerCase()));
          const incomplete = required.filter((i: any) => ["missing", "partial", "replace"].includes(getLmnpItemStatus(i)));
          const requiredOk = required.filter((i: any) => getLmnpItemStatus(i) === "ok").length;
          const requiredTotal = required.length + neverTracked.length;
          const compliancePercent = requiredTotal ? Math.round((requiredOk / requiredTotal) * 100) : 0;

          const missingLabels = [
            ...neverTracked.map((i) => i.label),
            ...incomplete.map((i: any) => i.label),
          ];

          return {
            property_id: target.property_id,
            lot_id: target.lot_id,
            label: target.label,
            compliance_percent: compliancePercent,
            missing_or_incomplete_items: missingLabels,
          };
        })
      );

      return { eligible_properties: results };
    },
  },
  {
    name: "open_inventaire_lmnp",
    description: "Ouvre l'inventaire mobilier LMNP pour un bien (et un lot si c'est un immeuble), prêt à vérifier ou compléter les obligations de logement meublé. À proposer si le bail créé est meublé, ou si l'utilisateur demande à voir/compléter l'inventaire.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string" },
        lot_id: { type: "string", description: "Si le bien est un immeuble (type='building')." },
      },
      required: ["property_id"],
    },
    mutates: false,
    navigate: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: property } = await admin.from("properties").select("id").eq("id", args.property_id).eq("user_id", ctx.userId).maybeSingle();
      if (!property) throw new Error("Bien introuvable ou non autorisé.");
      return {
        navigation: {
          section: "inventaire",
          link: { propertyId: args.property_id, lotId: args.lot_id || undefined },
          label: "Ouvrir l'inventaire LMNP pour ce bien",
        },
      };
    },
  },
  {
    name: "open_declaration_helper",
    description: "Ouvre l'aide à la déclaration fiscale (Finance) qui calcule micro-BIC vs réel, LMNP vs nu, avec les vrais chiffres du compte. À proposer pour une question de choix de régime fiscal ou de préparation de déclaration, plutôt que de répondre soi-même (l'outil calcule avec les vraies données, pas une estimation générique).",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    navigate: true,
    execute: async () => ({
      navigation: { section: "finance", link: { financeTab: "declaration" }, label: "Ouvrir l'aide à la déclaration" },
    }),
  },
  {
    name: "find_help_content",
    description: "Liste les guides pratiques et articles de blog gratuits de lokt.fr (titres + liens réels). À utiliser pour une question générale de droit locatif, fiscalité, gestion ou investissement qui sort du périmètre des actions de l'assistant : choisis 1-2 entrées les plus pertinentes dans la liste renvoyée et cite leur url exacte — n'invente JAMAIS un titre ou un lien qui n'est pas dans le résultat de cet outil.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    execute: async () => {
      const { GUIDES } = await import("../guides");
      const { getAllPostsMeta } = await import("../blog");
      const guides = GUIDES.map((g) => ({ title: g.title, url: `/guides/${g.slug}`, category: g.category }));
      const articles = getAllPostsMeta().map((p) => ({
        title: p.frontmatter.title,
        url: `/blog/${p.slug}`,
        category: p.frontmatter.category || null,
      }));
      return { guides, articles };
    },
  },
];

export function getAssistantTool(name: string): AssistantTool | undefined {
  return assistantTools.find((t) => t.name === name);
}

export function assistantToolDefinitionsForClaude() {
  return assistantTools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}
