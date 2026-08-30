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
import { getLeasePaymentDueDate } from "../rentSchedule";
import { LMNP_REQUIRED_ITEMS, getLmnpItemStatus, propertyRequiresLmnpInventory, lotRequiresLmnpInventory } from "./lmnpInventory";
import { IRL_TABLE, LATEST_IRL, dateToIrlQuarter, irlByQuarter } from "../irlData";

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

// Réplique exacte des helpers d'occupation de SectionBiens.tsx (composant cockpit) :
// on ne peut pas les importer depuis un composant React côté serveur, donc on
// garde les deux copies en phase à la main plutôt que d'introduire un import
// client->serveur artificiel.
function normalizeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
}

function isLeaseUsable(lease: any) {
  const status = String(lease?.status || "").toLowerCase();
  return status !== "draft" && status !== "archived";
}

function isLeaseCurrent(lease: any, now: Date) {
  if (String(lease?.status || "").toLowerCase() !== "active") return false;
  const start = normalizeDate(lease?.start_date);
  const end = normalizeDate(lease?.end_date);
  if (!start || start.getTime() > now.getTime()) return false;
  return !end || end.getTime() >= now.getTime();
}

function occupancyDaysForWindow(leases: any[], windowStart: Date, windowEnd: Date) {
  const intervals = leases
    .filter(isLeaseUsable)
    .map((lease) => {
      const start = normalizeDate(lease?.start_date);
      const rawEnd = normalizeDate(lease?.end_date);
      if (!start) return null;
      const end = rawEnd ? addDays(rawEnd, 1) : windowEnd;
      const clippedStart = new Date(Math.max(start.getTime(), windowStart.getTime()));
      const clippedEnd = new Date(Math.min(end.getTime(), windowEnd.getTime()));
      return clippedEnd.getTime() > clippedStart.getTime() ? { start: clippedStart, end: clippedEnd } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.start.getTime() - b.start.getTime()) as Array<{ start: Date; end: Date }>;

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start.getTime() > last.end.getTime()) {
      merged.push({ ...interval });
    } else if (interval.end.getTime() > last.end.getTime()) {
      last.end = interval.end;
    }
  }
  return merged.reduce((total, interval) => total + daysBetween(interval.start, interval.end), 0);
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

async function resolvePropertyAddress(admin: NonNullable<typeof supabaseAdmin>, userId: string, propertyId?: string | null, lotId?: string | null) {
  if (!propertyId) return "";
  const { data: property } = await admin.from("properties").select("label,address_line1,postal_code,city").eq("id", propertyId).eq("user_id", userId).maybeSingle();
  if (!property) return "";
  const address = [property.address_line1, property.postal_code, property.city].filter(Boolean).join(", ");
  return address || property.label || "";
}

// Même logique de trimestre IRL par défaut que le panneau de révision du
// cockpit (IrlRevisionPanel dans SectionRevision.tsx) : le trimestre de la
// date de signature, avec repli sur le trimestre disponible le plus proche si
// pas de correspondance exacte — pour ne jamais faire deviner un trimestre à
// Claude. Note : irl_reference (lu par le panneau via un cast "as any") n'est
// pas une colonne de la table leases — vit uniquement dans le payload JSON du
// contrat de bail — donc jamais utilisable ici sans une requête séparée.
function computeDefaultRefQuarter(lease: { start_date?: string | null }): string {
  if (!lease.start_date) return "";
  const exact = dateToIrlQuarter(lease.start_date);
  if (irlByQuarter(exact)) return exact;
  const [sy, sq] = exact.split("-T").map(Number);
  const startNum = sy * 4 + sq;
  for (const entry of IRL_TABLE) {
    const [ey, eq] = entry.quarter.split("-T").map(Number);
    if (ey * 4 + eq <= startNum) return entry.quarter;
  }
  return IRL_TABLE[IRL_TABLE.length - 1].quarter;
}

// Catégories Finance exposées à Loky — hors "rent" (géré uniquement via les
// quittances, jamais une écriture manuelle qui compterait le loyer deux fois)
// et "deposit_*" (gérées par le tool manage_deposit dédié, qui garde la
// cohérence avec les champs deposit_* du bail).
const FINANCE_CATEGORY_LABEL: Record<string, string> = {
  fees: "Frais plateforme / conciergerie",
  management: "Gestion / agence",
  repairs: "Entretien / travaux",
  copro: "Copropriété (non récupérable)",
  insurance: "Assurance (PNO/GLI…)",
  tax: "Taxe foncière",
  utilities: "Eau/élec/internet",
  charges_recovered: "Charges récupérées / refacturées",
  regularization: "Régularisation de charges",
  loan: "Crédit (mensualité)",
  other: "Autre",
  rent: "Loyer (quittance)",
  deposit_collected: "Caution reçue",
  deposit_returned: "Caution restituée",
  deposit_retained: "Retenue sur caution",
};

export const assistantTools: AssistantTool[] = [
  {
    name: "list_properties",
    description: "Liste les biens du compte (id, libellé, type, adresse, ville, statut, services délégués à une agence le cas échéant). delegated_services peut contenir 'bail_edl' : dans ce cas, le contrat de bail ET l'état des lieux sont gérés par une agence externe — lokt.fr ne propose alors que l'import du PDF fourni par l'agence, pas la saisie guidée. À utiliser pour retrouver l'id d'un bien mentionné par son nom ou son adresse avant toute autre action.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    execute: async (ctx) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("properties")
        .select("id,label,type,address_line1,city,status,delegated_services,delegation_agency_name")
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
    description: "Liste les baux du compte avec le bien et le locataire associés, y compris le dépôt de garantie (montant prévu, encaissé, restitué/retenu) et receipts_disabled (bail délégué à une agence : aucune quittance lokt n'est jamais générée pour ce bail, par conception — ne jamais présenter ça comme une anomalie). Utile pour retrouver le lease_id d'un bail existant ou répondre directement à une question sur la caution.",
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
        .select(
          "id,status,property_id,lot_id,tenant_id,rent_amount,charges_amount,start_date,end_date,deposit_amount,deposit_paid_at,deposit_paid_amount,deposit_returned_at,deposit_returned_amount,deposit_retained_amount,deposit_retained_reason,receipts_disabled"
        )
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
    description: "Donne le statut de paiement du loyer d'un bail pour un ou plusieurs mois : payé (avec date, montant et si une quittance a réellement été générée) ou non encore payé (avec l'échéance attendue). À utiliser pour répondre directement à 'est-ce que X a payé son loyer ?' ou 'pourquoi je n'ai pas de quittance ?' — ne redirige jamais ces questions vers open_quittances, et ne déduis jamais qu'une quittance existe du simple fait qu'un loyer est payé : utilise le champ has_receipt, jamais une supposition. Si un mois renvoie out_of_lease_range=true, ce mois est simplement antérieur au début du bail (lease_start_date) ou postérieur à sa fin (lease_end_date) : dis-le explicitement, ne présente JAMAIS ça comme un loyer manquant/en retard, et ne propose jamais de le confirmer ou de relancer le locataire pour ce mois-là.",
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
        .select("id,start_date,end_date,rent_amount,charges_amount,payment_day,payment_type,receipts_disabled")
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

      // Un mois hors bail (avant le début, après la fin) doit rester dans la
      // réponse au lieu d'être simplement omis : un tableau vide est ambigu pour
      // le modèle (aucun moyen de distinguer "hors bail" de "rien en base"), ce
      // qui l'amenait à présenter un mois antérieur au bail comme un loyer
      // manquant/en retard et à proposer de le confirmer ou de relancer dessus.
      const monthPeriods = months.map((m) => ({ month: m, period: getLeaseRentPeriod(lease, m) }));
      const validPeriods = monthPeriods.filter((mp) => mp.period) as Array<{ month: string; period: NonNullable<ReturnType<typeof getLeaseRentPeriod>> }>;

      const [{ data: paymentsRows }, { data: receiptsRows }] = validPeriods.length
        ? await Promise.all([
            admin
              .from("rent_payments")
              .select("period_start,period_end,paid_at,total_amount,payment_method")
              .eq("lease_id", args.lease_id)
              .in("period_start", validPeriods.map((mp) => mp.period.periodStart)),
            admin
              .from("rent_receipts")
              .select("period_start,status,pdf_url")
              .eq("lease_id", args.lease_id)
              .in("period_start", validPeriods.map((mp) => mp.period.periodStart)),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      const byStart = new Map((paymentsRows || []).map((row: any) => [row.period_start, row]));
      const receiptByStart = new Map((receiptsRows || []).map((row: any) => [row.period_start, row]));

      const leaseStart = lease.start_date ? String(lease.start_date).slice(0, 10) : null;
      const leaseEnd = lease.end_date ? String(lease.end_date).slice(0, 10) : null;

      return {
        receipts_disabled: !!lease.receipts_disabled,
        payments: monthPeriods.map(({ month, period }) => {
          if (!period) {
            const beforeStart = leaseStart ? `${month}-01` < leaseStart : false;
            return {
              period_month: month,
              out_of_lease_range: true,
              reason: beforeStart ? "before_lease_start" : "after_lease_end",
              lease_start_date: leaseStart,
              lease_end_date: leaseEnd,
            };
          }
          const row = byStart.get(period.periodStart) as any;
          const receipt = receiptByStart.get(period.periodStart) as any;
          const dueDate = getLeasePaymentDueDate(lease, month);
          return {
            period_start: period.periodStart,
            period_end: period.periodEnd,
            due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
            expected_amount: period.total,
            paid: !!row?.paid_at,
            paid_at: row?.paid_at || null,
            paid_amount: row?.total_amount ?? null,
            payment_method: row?.payment_method || null,
            has_receipt: !!receipt?.pdf_url,
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
    name: "update_tenant",
    description: "Modifie le nom, l'email, le téléphone ou les notes d'une fiche locataire existante.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        full_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["tenant_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const patch: Record<string, any> = {};
      if (args.full_name) patch.full_name = String(args.full_name).trim();
      if (args.email !== undefined) patch.email = args.email ? String(args.email).trim() : null;
      if (args.phone !== undefined) patch.phone = args.phone ? String(args.phone).trim() : null;
      if (args.notes !== undefined) patch.notes = args.notes ? String(args.notes).trim() : null;
      if (Object.keys(patch).length === 0) throw new Error("Indique au moins un champ à modifier (nom, email, téléphone, notes).");
      const { data, error } = await admin.from("tenants").update(patch).eq("id", args.tenant_id).eq("user_id", ctx.userId).select("id,full_name").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Locataire introuvable ou non autorisé.");
      return { tenant_id: data.id, full_name: data.full_name };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const tenantName = await resolveTenantName(admin, ctx.userId, args.tenant_id);
      const rows: Array<{ label: string; value: string }> = [{ label: "Locataire", value: tenantName }];
      if (args.full_name) rows.push({ label: "Nouveau nom", value: String(args.full_name) });
      if (args.email !== undefined) rows.push({ label: "Nouvel email", value: args.email ? String(args.email) : "(supprimé)" });
      if (args.phone !== undefined) rows.push({ label: "Nouveau téléphone", value: args.phone ? String(args.phone) : "(supprimé)" });
      if (args.notes !== undefined) rows.push({ label: "Notes", value: args.notes ? String(args.notes) : "(supprimées)" });
      return rows;
    },
  },
  {
    name: "delete_tenant",
    description: "Supprime définitivement une fiche locataire. Refusé si ce locataire a le moindre historique de bail (même terminé) — dans ce cas, propose d'archiver la fiche à la place (via terminate_lease si un bail est encore actif, ou explique que l'historique doit être conservé).",
    input_schema: {
      type: "object",
      properties: { tenant_id: { type: "string" } },
      required: ["tenant_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { count } = await admin.from("leases").select("id", { count: "exact", head: true }).eq("tenant_id", args.tenant_id).eq("user_id", ctx.userId);
      if ((count || 0) > 0) {
        throw new Error("Suppression impossible : ce locataire a un historique de bail (même terminé). Les données (quittances, comptabilité) doivent être conservées — le bail archivé suffit à le masquer du cockpit actif.");
      }
      const { error } = await admin.from("tenants").delete().eq("id", args.tenant_id).eq("user_id", ctx.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const tenantName = await resolveTenantName(admin, ctx.userId, args.tenant_id);
      return [{ label: "Locataire", value: tenantName }, { label: "Conséquence", value: "Suppression définitive de la fiche" }];
    },
  },
  {
    name: "restore_tenant",
    description: "Restaure une fiche locataire archivée (ne réactive pas un bail terminé pour autant).",
    input_schema: {
      type: "object",
      properties: { tenant_id: { type: "string" } },
      required: ["tenant_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("tenants")
        .update({ archived_at: null, archived_reason: null })
        .eq("id", args.tenant_id)
        .eq("user_id", ctx.userId)
        .select("id,full_name")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Locataire introuvable ou non autorisé.");
      return { tenant_id: data.id, full_name: data.full_name };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const tenantName = await resolveTenantName(admin, ctx.userId, args.tenant_id);
      return [{ label: "Locataire", value: tenantName }];
    },
  },
  {
    name: "invite_tenant_portal",
    description: "Invite un locataire à créer son espace locataire lokt.fr (quittances, documents, suivi de loyer, et messagerie si activée). Nécessite que le locataire ait un email enregistré. Réservé aux abonnements payants.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        messaging_enabled: { type: "boolean", description: "Active aussi la messagerie avec ce locataire. Vrai par défaut." },
      },
      required: ["tenant_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/tenant-portal/invite", {
        tenantId: args.tenant_id,
        messagingEnabled: args.messaging_enabled !== false,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const tenantName = await resolveTenantName(admin, ctx.userId, args.tenant_id);
      return [
        { label: "Locataire", value: tenantName },
        { label: "Messagerie", value: args.messaging_enabled === false ? "Désactivée" : "Activée" },
      ];
    },
  },
  {
    name: "toggle_tenant_messaging",
    description: "Active ou désactive la messagerie avec un locataire déjà invité au portail (n'invite pas au portail lui-même : utiliser invite_tenant_portal si ce n'est pas encore fait).",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        messaging_enabled: { type: "boolean" },
      },
      required: ["tenant_id", "messaging_enabled"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/tenant-portal/toggle-messaging", {
        tenantId: args.tenant_id,
        messagingEnabled: !!args.messaging_enabled,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const tenantName = await resolveTenantName(admin, ctx.userId, args.tenant_id);
      return [
        { label: "Locataire", value: tenantName },
        { label: "Messagerie", value: args.messaging_enabled ? "Activée" : "Désactivée" },
      ];
    },
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
    name: "terminate_lease",
    description: "Résilie un bail : fixe la date de sortie, passe le bail en 'terminé', arrête les relances/quittances automatiques et archive la fiche locataire. Action significative et peu réversible : à utiliser seulement quand l'utilisateur confirme clairement vouloir mettre fin au bail (ex. 'résilie le bail de Julien', 'il part le 30/09'), jamais pour une simple question sur la date de fin.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        exit_date: { type: "string", description: "Date de sortie effective, YYYY-MM-DD." },
        reason: { type: "string", description: "Motif du départ (optionnel)." },
      },
      required: ["lease_id", "exit_date"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin
        .from("leases")
        .select("id,tenant_id,start_date,status")
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");
      if (lease.status === "ended") throw new Error("Ce bail est déjà terminé.");
      const exitDate = String(args.exit_date);
      if (exitDate < lease.start_date) throw new Error("La date de sortie doit être postérieure au début du bail.");

      const now = new Date().toISOString();
      const { error: leaseErr } = await admin
        .from("leases")
        .update({ status: "ended", end_date: exitDate, auto_reminder_enabled: false, auto_quittance_enabled: false, updated_at: now })
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId);
      if (leaseErr) throw new Error(leaseErr.message);

      const { error: tenantErr } = await admin
        .from("tenants")
        .update({ archived_at: now, archived_reason: args.reason ? String(args.reason) : "Départ du locataire" })
        .eq("id", lease.tenant_id)
        .eq("user_id", ctx.userId);
      if (tenantErr) throw new Error(tenantErr.message);

      return {
        ok: true,
        next_steps: [{ section: "etat_des_lieux", link: { leaseId: args.lease_id }, label: "Faire l'état des lieux de sortie" }],
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
      rows.push({ label: "Date de sortie", value: String(args.exit_date || "—") });
      rows.push({ label: "Conséquence", value: "Bail clôturé, locataire archivé, quittances/relances automatiques arrêtées" });
      return rows;
    },
  },
  {
    name: "cancel_payment",
    description: "Annule un paiement confirmé par erreur pour un bail et une période donnés : remet le loyer en attente et supprime la quittance/écriture Finance associée. À utiliser quand l'utilisateur dit s'être trompé en confirmant un paiement.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_start: { type: "string", description: "YYYY-MM-DD" },
        period_end: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["lease_id", "period_start", "period_end"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/receipts/cancel-payment", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        periodStart: args.period_start,
        periodEnd: args.period_end,
      });
      return data;
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
    name: "resend_receipt",
    description: "Renvoie par email une quittance déjà générée pour un bail et un mois donnés. Nécessite qu'un paiement ait déjà été confirmé pour ce mois (confirm_payment) — sinon il n'y a pas de quittance à renvoyer.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        period_month: { type: "string", description: "Mois de la quittance, YYYY-MM." },
      },
      required: ["lease_id", "period_month"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const yyyymm = String(args.period_month);
      const [y, m] = yyyymm.split("-").map(Number);
      // Borne haute exclusive (1er jour du mois suivant) plutôt qu'un "-31"
      // fixe : invalide pour les mois à 28/29/30 jours (ex. "2026-06-31"
      // fait échouer la comparaison de date côté Postgres).
      const nextMonthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const { data: receipt } = await admin
        .from("rent_receipts")
        .select("id,pdf_url")
        .eq("lease_id", args.lease_id)
        .gte("period_start", `${yyyymm}-01`)
        .lt("period_start", nextMonthStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!receipt) throw new Error("Aucune quittance trouvée pour cette période — confirme d'abord le paiement (confirm_payment).");
      const data = await callInternalApi(ctx, "/api/receipts/send", { userId: ctx.userId, receiptId: receipt.id, resendOnly: true });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      rows.push({ label: "Mois", value: String(args.period_month || "—") });
      return rows;
    },
  },
  {
    name: "manage_deposit",
    description: "Encaisse, restitue ou annule une opération sur le dépôt de garantie d'un bail. action='collect' encaisse la caution ; action='return' la restitue (avec retenue éventuelle et motif obligatoire si retenue) ; action='cancel_collect'/'cancel_return' annule l'opération correspondante déjà enregistrée.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        action: { type: "string", enum: ["collect", "return", "cancel_collect", "cancel_return"] },
        paid_at: { type: "string", description: "Date d'encaissement YYYY-MM-DD (action='collect')." },
        paid_amount: { type: "number", description: "Montant encaissé, sinon le montant du dépôt prévu au bail (action='collect')." },
        returned_at: { type: "string", description: "Date de restitution YYYY-MM-DD (action='return')." },
        returned_amount: { type: "number", description: "Montant restitué au locataire (action='return')." },
        retained_amount: { type: "number", description: "Montant retenu, si applicable (action='return')." },
        retained_reason: { type: "string", description: "Motif de la retenue — obligatoire si retained_amount > 0 (action='return')." },
      },
      required: ["lease_id", "action"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const action = String(args.action);
      const data = await callInternalApi(ctx, "/api/deposits", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        action,
        paid_at: args.paid_at,
        paid_amount: args.paid_amount,
        returned_at: args.returned_at,
        returned_amount: args.returned_amount,
        retained_amount: args.retained_amount,
        retained_reason: args.retained_reason,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      const action = String(args.action);
      rows.push({ label: "Action", value: { collect: "Encaisser la caution", return: "Restituer la caution", cancel_collect: "Annuler l'encaissement", cancel_return: "Annuler la restitution" }[action] || action });
      if (action === "collect") {
        rows.push({ label: "Montant", value: args.paid_amount != null ? euro(args.paid_amount) : "Montant prévu au bail" });
        rows.push({ label: "Date", value: String(args.paid_at || "—") });
      }
      if (action === "return") {
        if (args.returned_amount != null) rows.push({ label: "Restitué", value: euro(args.returned_amount) });
        if (args.retained_amount != null) rows.push({ label: "Retenu", value: euro(args.retained_amount) });
        if (args.retained_reason) rows.push({ label: "Motif retenue", value: String(args.retained_reason) });
        rows.push({ label: "Date", value: String(args.returned_at || "—") });
      }
      return rows;
    },
  },
  {
    name: "add_finance_transaction",
    description: "Ajoute une écriture manuelle dans Finance (charge ou recette hors loyer, ex. travaux, assurance, taxe foncière, crédit). Ne jamais utiliser pour un loyer (géré uniquement via confirm_payment/quittances) ni pour le dépôt de garantie (voir manage_deposit).",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Optionnel : bien concerné." },
        lease_id: { type: "string", description: "Optionnel : bail concerné." },
        direction: { type: "string", enum: ["in", "out"], description: "'in' = recette, 'out' = dépense." },
        category: { type: "string", enum: ["fees", "management", "repairs", "copro", "insurance", "tax", "utilities", "charges_recovered", "regularization", "loan", "other"] },
        label: { type: "string", description: "Libellé court de l'écriture." },
        amount: { type: "number" },
        occurred_at: { type: "string", description: "Date de l'écriture, YYYY-MM-DD." },
        notes: { type: "string" },
      },
      required: ["direction", "category", "amount", "occurred_at"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const payload = {
        user_id: ctx.userId,
        property_id: args.property_id || null,
        lease_id: args.lease_id || null,
        receipt_id: null,
        direction: String(args.direction),
        status: args.direction === "in" ? "received" : "paid",
        category: String(args.category),
        label: args.label ? String(args.label).trim() : null,
        amount: Number(args.amount),
        notes: args.notes ? String(args.notes).trim() : null,
        occurred_at: String(args.occurred_at),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("transactions").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { transaction_id: data.id };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const rows: Array<{ label: string; value: string }> = [];
      if (args.property_id) rows.push({ label: "Bien", value: await resolvePropertyLabel(admin, ctx.userId, args.property_id) });
      rows.push({ label: "Catégorie", value: FINANCE_CATEGORY_LABEL[String(args.category)] || String(args.category || "—") });
      rows.push({ label: "Sens", value: args.direction === "in" ? "Recette" : "Dépense" });
      rows.push({ label: "Montant", value: euro(args.amount) });
      rows.push({ label: "Date", value: String(args.occurred_at || "—") });
      if (args.label) rows.push({ label: "Libellé", value: String(args.label) });
      return rows;
    },
  },
  {
    name: "list_finance_transactions",
    description: "Liste les écritures Finance existantes (charges, recettes, loyers, dépôts) ET renvoie un résumé chiffré déjà calculé (total encaissé, total dépensé, net, montants en attente non confirmés). Pour toute question de type cashflow/bilan/'combien j'ai gagné', utilise TOUJOURS les chiffres du champ summary tels quels — ne resomme jamais les lignes de transactions toi-même, et ne mélange jamais summary.pending_in_not_confirmed (non reçu) avec summary.total_in_confirmed (déjà reçu). À utiliser aussi pour toute question sur les écritures/charges déjà enregistrées (ex. 'quelles sont mes écritures récurrentes pour tel bien ?') — jamais open_declaration_helper pour ce type de question, qui sert uniquement à préparer une déclaration fiscale.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Optionnel : filtrer sur un bien." },
        lease_id: { type: "string", description: "Optionnel : filtrer sur un bail." },
        recurring_only: { type: "boolean", description: "Si vrai, ne renvoie que les écritures récurrentes (modèles), pas leurs occurrences passées générées." },
        limit: { type: "number", description: "Nombre maximum d'écritures détaillées renvoyées dans 'transactions', 30 par défaut (max 100) — n'affecte pas le calcul de 'summary', qui porte sur l'ensemble des écritures correspondant au filtre." },
      },
      required: [],
    },
    mutates: false,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const requestedLimit = Math.min(100, Math.max(1, Number(args.limit) || 30));
      let query = admin
        .from("transactions")
        .select("id,property_id,lease_id,direction,status,category,label,amount,occurred_at,is_recurring,recurrence_frequency,recurrence_since,recurrence_end_date,notes")
        .eq("user_id", ctx.userId)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (args.property_id) query = query.eq("property_id", String(args.property_id));
      if (args.lease_id) query = query.eq("lease_id", String(args.lease_id));
      if (args.recurring_only) query = query.eq("is_recurring", true);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = data || [];

      // Résumé calculé ici, jamais laissé au modèle : seules les écritures
      // confirmées (received/paid) comptent comme du cashflow réel — une
      // écriture "expected" (non confirmée) reste distincte pour ne jamais
      // être présentée comme déjà encaissée/payée.
      let totalIn = 0;
      let totalOut = 0;
      let pendingIn = 0;
      let pendingOut = 0;
      for (const t of rows) {
        const amount = Number(t.amount || 0);
        const confirmed = t.status === "received" || t.status === "paid";
        if (t.direction === "in") {
          if (confirmed) totalIn += amount;
          else pendingIn += amount;
        } else {
          if (confirmed) totalOut += amount;
          else pendingOut += amount;
        }
      }

      return {
        summary: {
          total_in_confirmed: Math.round(totalIn * 100) / 100,
          total_out_confirmed: Math.round(totalOut * 100) / 100,
          net_confirmed: Math.round((totalIn - totalOut) * 100) / 100,
          pending_in_not_confirmed: Math.round(pendingIn * 100) / 100,
          pending_out_not_confirmed: Math.round(pendingOut * 100) / 100,
          transactions_counted_in_summary: rows.length,
        },
        transactions: rows.slice(0, requestedLimit).map((t: any) => ({
          ...t,
          category_label: FINANCE_CATEGORY_LABEL[t.category] || t.category,
        })),
      };
    },
  },
  {
    name: "open_finance",
    description: "Ouvre l'écran Finance (grand livre des écritures, trésorerie). À utiliser quand l'utilisateur veut consulter/gérer lui-même ses écritures plutôt que d'obtenir la réponse directement via list_finance_transactions.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    navigate: true,
    execute: async () => ({
      navigation: { section: "finance", link: { financeTab: "finance" }, label: "Ouvrir Finance" },
    }),
  },
  {
    name: "open_performance",
    description: "Ouvre l'écran Performance (cash-flow par bien, rentabilité, plan d'action d'optimisation). À proposer pour une question de cashflow/rentabilité/analyse de performance quand l'utilisateur veut explorer lui-même le détail — jamais open_finance pour ce type de question, qui n'affiche que le grand livre des écritures sans calcul de rentabilité.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    navigate: true,
    execute: async () => ({
      navigation: { section: "performance", link: {}, label: "Ouvrir Performance" },
    }),
  },
  {
    name: "get_occupancy_stats",
    description: "Calcule directement le taux d'occupation du parc — global et bien par bien (immeuble = un taux par lot) — sur une fenêtre glissante de 12 mois, avec le nombre de biens occupés/vacants maintenant, le turnover (nouvelles entrées locataire sur 12 mois) et l'ancienneté moyenne du locataire en place. Même calcul que le bloc \"Pilotage occupation\" de l'écran Biens. Utilise EXCLUSIVEMENT les chiffres renvoyés (occupancy_rate_12m, occupied_now, vacant_now, turnover_12m, average_current_tenant_days, per_unit) pour répondre à toute question sur le taux d'occupation / la vacance des biens — ne recalcule jamais ça toi-même à partir de list_properties/list_leases, tu ferais des erreurs. Termine en proposant open_biens (jamais open_performance) seulement si l'utilisateur veut explorer le détail visuellement.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    execute: async (ctx) => {
      const admin = requireAdmin();
      const now = new Date();
      const windowEnd = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
      const windowStart = addDays(windowEnd, -365);

      const [{ data: properties, error: propsError }, { data: lots, error: lotsError }, { data: leases, error: leasesError }] = await Promise.all([
        admin.from("properties").select("id,label,type").eq("user_id", ctx.userId).neq("status", "archived"),
        admin.from("property_lots").select("id,label,property_id,status,sort_order").eq("user_id", ctx.userId),
        admin.from("leases").select("id,status,property_id,lot_id,start_date,end_date").eq("user_id", ctx.userId),
      ]);
      if (propsError) throw new Error(propsError.message);
      if (lotsError) throw new Error(lotsError.message);
      if (leasesError) throw new Error(leasesError.message);

      const activeLotsByProperty = new Map<string, any[]>();
      for (const lot of lots || []) {
        if (String((lot as any)?.status || "active").toLowerCase() === "archived") continue;
        const pid = (lot as any)?.property_id;
        if (!pid) continue;
        if (!activeLotsByProperty.has(pid)) activeLotsByProperty.set(pid, []);
        activeLotsByProperty.get(pid)!.push(lot);
      }
      for (const arr of activeLotsByProperty.values()) arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      type Unit = { label: string; leases: any[] };
      const units: Unit[] = [];
      for (const property of properties || []) {
        const propertyLots = (property as any)?.type === "building" ? activeLotsByProperty.get((property as any).id) || [] : [];
        if (propertyLots.length > 0) {
          for (const lot of propertyLots) {
            units.push({
              label: `${(property as any).label} — ${(lot as any).label}`,
              leases: (leases || []).filter((l: any) => l.lot_id === (lot as any).id),
            });
          }
        } else {
          units.push({ label: (property as any).label, leases: (leases || []).filter((l: any) => l.property_id === (property as any).id) });
        }
      }

      const rows = units.map(({ label, leases: unitLeases }) => {
        const usableLeases = unitLeases.filter(isLeaseUsable);
        const firstLeaseStart =
          usableLeases
            .map((l: any) => normalizeDate(l?.start_date))
            .filter((d): d is Date => Boolean(d))
            .sort((a, b) => a.getTime() - b.getTime())[0] || null;
        const analysisStart =
          firstLeaseStart && firstLeaseStart.getTime() > windowStart.getTime() && firstLeaseStart.getTime() < windowEnd.getTime()
            ? firstLeaseStart
            : windowStart;
        const analysisDays = Math.max(1, daysBetween(analysisStart, windowEnd));
        const currentLease =
          unitLeases
            .filter((l: any) => isLeaseCurrent(l, now))
            .sort((a: any, b: any) => (normalizeDate(b?.start_date)?.getTime() || 0) - (normalizeDate(a?.start_date)?.getTime() || 0))[0] || null;
        const occupiedDays12m = occupancyDaysForWindow(unitLeases, analysisStart, windowEnd);
        const vacancyDays12m = Math.max(0, analysisDays - occupiedDays12m);
        const turnover12m = unitLeases.filter((l: any) => {
          const start = normalizeDate(l?.start_date);
          return start && start.getTime() >= windowStart.getTime() && start.getTime() < windowEnd.getTime() && isLeaseUsable(l);
        }).length;
        const currentStart = normalizeDate(currentLease?.start_date);
        const currentTenantDays = currentStart ? daysBetween(currentStart, now) : null;
        return {
          label,
          occupied_now: !!currentLease,
          current_tenant_days: currentTenantDays,
          occupancy_rate_12m: Math.round((occupiedDays12m / analysisDays) * 1000) / 10,
          vacancy_days_12m: vacancyDays12m,
          turnover_12m: turnover12m,
          analysisDays,
          occupiedDays12m,
        };
      });

      const totalWindowDays = Math.max(1, rows.reduce((sum, r) => sum + r.analysisDays, 0));
      const totalOccupiedDays = rows.reduce((sum, r) => sum + r.occupiedDays12m, 0);
      const occupiedNow = rows.filter((r) => r.occupied_now).length;
      const currentDurations = rows.map((r) => r.current_tenant_days).filter((d): d is number => d != null);
      const averageCurrentTenantDays = currentDurations.length
        ? Math.round(currentDurations.reduce((sum, d) => sum + d, 0) / currentDurations.length)
        : null;

      return {
        total_units: rows.length,
        occupied_now: occupiedNow,
        vacant_now: rows.length - occupiedNow,
        occupancy_rate_12m: rows.length ? Math.round((totalOccupiedDays / totalWindowDays) * 1000) / 10 : 0,
        average_vacancy_days_12m: rows.length ? Math.round(rows.reduce((sum, r) => sum + r.vacancy_days_12m, 0) / rows.length) : 0,
        turnover_12m: rows.reduce((sum, r) => sum + r.turnover_12m, 0),
        average_current_tenant_days: averageCurrentTenantDays,
        per_unit: rows.map((r) => ({
          label: r.label,
          occupied_now: r.occupied_now,
          occupancy_rate_12m: r.occupancy_rate_12m,
          vacancy_days_12m: r.vacancy_days_12m,
          turnover_12m: r.turnover_12m,
        })),
      };
    },
  },
  {
    name: "open_biens",
    description: "Ouvre l'écran Biens, dont le bloc \"Pilotage occupation\" affiche le taux d'occupation du parc (12 mois), le nombre de biens occupés/vacants, le turnover et l'ancienneté des locataires. À proposer seulement après avoir donné les chiffres via get_occupancy_stats, si l'utilisateur veut explorer le détail visuellement — jamais open_performance pour une question d'occupation, cet écran-là calcule la rentabilité et le cash-flow, pas l'occupation.",
    input_schema: { type: "object", properties: {}, required: [] },
    mutates: false,
    navigate: true,
    execute: async () => ({
      navigation: { section: "biens", link: {}, label: "Ouvrir Biens" },
    }),
  },
  {
    name: "delete_finance_transaction",
    description: "Supprime une écriture Finance simple (non récurrente). Refuse si l'écriture est liée à une quittance automatique (utiliser cancel_payment) ou à une opération de dépôt de garantie (utiliser manage_deposit) ou si elle fait partie d'une série récurrente (utiliser stop_recurring_transaction).",
    input_schema: {
      type: "object",
      properties: { transaction_id: { type: "string" } },
      required: ["transaction_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin
        .from("transactions")
        .select("id,receipt_id,category,is_recurring,recurrence_parent_id")
        .eq("id", args.transaction_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!tx) throw new Error("Écriture introuvable ou non autorisée.");
      if (tx.receipt_id) throw new Error("Cette écriture est liée à une quittance automatique — annule le paiement concerné via cancel_payment plutôt que de la supprimer directement.");
      if (["deposit_collected", "deposit_returned", "deposit_retained"].includes(String(tx.category))) {
        throw new Error("Cette écriture concerne un dépôt de garantie — utilise manage_deposit pour l'annuler proprement.");
      }
      if (tx.is_recurring || tx.recurrence_parent_id) throw new Error("Cette écriture fait partie d'une série récurrente — utilise stop_recurring_transaction pour l'arrêter proprement.");
      const { error } = await admin.from("transactions").delete().eq("id", args.transaction_id).eq("user_id", ctx.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin.from("transactions").select("label,category,amount,occurred_at,property_id").eq("id", args.transaction_id).eq("user_id", ctx.userId).maybeSingle();
      if (!tx) return [];
      const rows: Array<{ label: string; value: string }> = [];
      if (tx.property_id) rows.push({ label: "Bien", value: await resolvePropertyLabel(admin, ctx.userId, tx.property_id) });
      rows.push({ label: "Écriture", value: tx.label || FINANCE_CATEGORY_LABEL[tx.category] || tx.category });
      rows.push({ label: "Montant", value: euro(tx.amount) });
      rows.push({ label: "Date", value: String(tx.occurred_at || "—") });
      return rows;
    },
  },
  {
    name: "stop_recurring_transaction",
    description: "Arrête une écriture Finance récurrente à partir d'aujourd'hui : ferme la série et supprime les occurrences futures pas encore échues. Les occurrences passées restent inchangées.",
    input_schema: {
      type: "object",
      properties: { transaction_id: { type: "string", description: "Id de l'écriture récurrente (le modèle, pas une occurrence générée)." } },
      required: ["transaction_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin.from("transactions").select("id,is_recurring").eq("id", args.transaction_id).eq("user_id", ctx.userId).maybeSingle();
      if (!tx) throw new Error("Écriture introuvable ou non autorisée.");
      if (!tx.is_recurring) throw new Error("Cette écriture n'est pas une récurrente — utilise delete_finance_transaction pour la supprimer directement.");
      const today = new Date().toISOString().slice(0, 10);
      const { error: upErr } = await admin
        .from("transactions")
        .update({ recurrence_end_date: today, updated_at: new Date().toISOString() })
        .eq("id", args.transaction_id)
        .eq("user_id", ctx.userId);
      if (upErr) throw new Error(upErr.message);
      const { error: delErr } = await admin
        .from("transactions")
        .delete()
        .eq("recurrence_parent_id", args.transaction_id)
        .eq("user_id", ctx.userId)
        .gt("occurred_at", today);
      if (delErr) throw new Error(delErr.message);
      return { ok: true };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin.from("transactions").select("label,category,amount,property_id").eq("id", args.transaction_id).eq("user_id", ctx.userId).maybeSingle();
      if (!tx) return [];
      const rows: Array<{ label: string; value: string }> = [];
      if (tx.property_id) rows.push({ label: "Bien", value: await resolvePropertyLabel(admin, ctx.userId, tx.property_id) });
      rows.push({ label: "Écriture", value: tx.label || FINANCE_CATEGORY_LABEL[tx.category] || tx.category });
      rows.push({ label: "Montant", value: euro(tx.amount) });
      rows.push({ label: "Conséquence", value: "Arrêtée à partir d'aujourd'hui, occurrences futures supprimées" });
      return rows;
    },
  },
  {
    name: "update_recurring_transaction",
    description: "Modifie le montant et/ou le libellé d'une écriture Finance récurrente. scope='future' (par défaut) ne change que les prochaines occurrences, scope='all' modifie aussi les occurrences déjà enregistrées.",
    input_schema: {
      type: "object",
      properties: {
        transaction_id: { type: "string" },
        amount: { type: "number" },
        label: { type: "string" },
        scope: { type: "string", enum: ["future", "all"], description: "'future' par défaut." },
      },
      required: ["transaction_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin.from("transactions").select("id,is_recurring").eq("id", args.transaction_id).eq("user_id", ctx.userId).maybeSingle();
      if (!tx) throw new Error("Écriture introuvable ou non autorisée.");
      if (!tx.is_recurring) throw new Error("Cette écriture n'est pas une récurrente.");
      if (args.amount == null && !args.label) throw new Error("Indique au moins un montant ou un libellé à modifier.");

      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (args.amount != null) patch.amount = Number(args.amount);
      if (args.label) patch.label = String(args.label).trim();

      const { error: pErr } = await admin.from("transactions").update(patch).eq("id", args.transaction_id).eq("user_id", ctx.userId);
      if (pErr) throw new Error(pErr.message);

      const scope = args.scope === "all" ? "all" : "future";
      let childQuery = admin.from("transactions").update(patch).eq("recurrence_parent_id", args.transaction_id).eq("user_id", ctx.userId);
      if (scope === "future") {
        const today = new Date().toISOString().slice(0, 10);
        childQuery = childQuery.gt("occurred_at", today);
      }
      const { error: cErr } = await childQuery;
      if (cErr) throw new Error(cErr.message);
      return { ok: true };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: tx } = await admin.from("transactions").select("label,category,amount,property_id").eq("id", args.transaction_id).eq("user_id", ctx.userId).maybeSingle();
      const rows: Array<{ label: string; value: string }> = [];
      if (tx?.property_id) rows.push({ label: "Bien", value: await resolvePropertyLabel(admin, ctx.userId, tx.property_id) });
      rows.push({ label: "Écriture", value: tx?.label || FINANCE_CATEGORY_LABEL[String(tx?.category)] || String(tx?.category || "—") });
      if (args.amount != null) rows.push({ label: "Nouveau montant", value: euro(args.amount) });
      if (args.label) rows.push({ label: "Nouveau libellé", value: String(args.label) });
      rows.push({ label: "Portée", value: args.scope === "all" ? "Toutes les occurrences" : "Occurrences futures uniquement" });
      return rows;
    },
  },
  {
    name: "send_rent_revision",
    description: "Envoie au locataire la notification de révision annuelle du loyer selon l'IRL (Indice de Référence des Loyers). Résout automatiquement le trimestre de référence et le dernier IRL publié si non précisés — ne demande les trimestres à l'utilisateur que s'il veut les changer explicitement.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        ref_quarter: { type: "string", description: "Trimestre IRL de référence (ex. '2023-T2'). Calculé automatiquement si omis." },
        new_quarter: { type: "string", description: "Nouveau trimestre IRL à appliquer. Dernier publié par défaut si omis." },
      },
      required: ["lease_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin
        .from("leases")
        .select("id,start_date,rent_amount,irl_sent_at")
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");
      if (lease.irl_sent_at) throw new Error("Une révision est déjà en cours pour ce bail — annule-la d'abord (cancel_rent_revision) pour en renvoyer une nouvelle.");

      const refQuarter = String(args.ref_quarter || computeDefaultRefQuarter(lease));
      const newQuarter = String(args.new_quarter || LATEST_IRL.quarter);
      if (!irlByQuarter(refQuarter)) throw new Error(`Trimestre IRL de référence inconnu : ${refQuarter}`);
      if (!irlByQuarter(newQuarter)) throw new Error(`Trimestre IRL inconnu : ${newQuarter}`);

      const data = await callInternalApi(ctx, "/api/landlord/send-revision", { userId: ctx.userId, leaseId: args.lease_id, refQuarter, newQuarter });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin.from("leases").select("start_date,rent_amount").eq("id", args.lease_id).eq("user_id", ctx.userId).maybeSingle();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const refQuarter = String(args.ref_quarter || (lease ? computeDefaultRefQuarter(lease) : ""));
      const newQuarter = String(args.new_quarter || LATEST_IRL.quarter);
      const refEntry = irlByQuarter(refQuarter);
      const newEntry = irlByQuarter(newQuarter);
      const currentRent = Number(lease?.rent_amount || 0);
      const newRent = refEntry && newEntry && refEntry.value > 0 ? Math.round(((currentRent * newEntry.value) / refEntry.value) * 100) / 100 : null;
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      rows.push({ label: "IRL référence", value: refEntry?.label || refQuarter || "—" });
      rows.push({ label: "Nouvel IRL", value: newEntry?.label || newQuarter });
      rows.push({ label: "Loyer actuel", value: euro(currentRent) });
      if (newRent != null) rows.push({ label: "Nouveau loyer", value: euro(newRent) });
      return rows;
    },
  },
  {
    name: "cancel_rent_revision",
    description: "Annule une révision de loyer IRL envoyée mais pas encore appliquée.",
    input_schema: {
      type: "object",
      properties: { lease_id: { type: "string" } },
      required: ["lease_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const data = await callInternalApi(ctx, "/api/landlord/cancel-revision", { userId: ctx.userId, leaseId: args.lease_id });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      return leaseInfo ? [{ label: "Bien", value: leaseInfo.propertyLabel }, { label: "Locataire", value: leaseInfo.tenantName }] : [];
    },
  },
  {
    name: "generate_mise_en_demeure",
    description: "Génère une mise en demeure de payer (PDF) pour un locataire en impayé. Calcule lui-même les mois impayés réels du bail sur la période demandée — ne jamais laisser Claude inventer les montants ou les mois.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        months: { type: "number", description: "Nombre de mois à vérifier en remontant depuis aujourd'hui pour détecter les impayés, 6 par défaut (max 24)." },
        signature_place: { type: "string", description: "Ville depuis laquelle le courrier est signé. Par défaut la ville du bien." },
      },
      required: ["lease_id"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin
        .from("leases")
        .select("id,property_id,lot_id,tenant_id,rent_amount,charges_amount")
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");

      const { data: tenant } = await admin.from("tenants").select("full_name").eq("id", lease.tenant_id).eq("user_id", ctx.userId).maybeSingle();
      const propertyAddress = await resolvePropertyAddress(admin, ctx.userId, lease.property_id, lease.lot_id);
      const { data: property } = await admin.from("properties").select("city").eq("id", lease.property_id).eq("user_id", ctx.userId).maybeSingle();

      const monthsCount = Math.min(24, Math.max(1, Number(args.months) || 6));
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [by, bm] = currentMonth.split("-").map(Number);
      const months = Array.from({ length: monthsCount }, (_, i) => {
        const d = new Date(Date.UTC(by, bm - 1 - i, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      });
      const periods = months.map((m) => getLeaseRentPeriod(lease, m)).filter((p): p is NonNullable<typeof p> => !!p);
      const { data: paymentsRows } = await admin
        .from("rent_payments")
        .select("period_start,paid_at,total_amount")
        .eq("lease_id", args.lease_id)
        .in("period_start", periods.map((p) => p.periodStart));
      const byStart = new Map((paymentsRows || []).map((r: any) => [r.period_start, r]));

      const unpaidRows = periods
        .filter((p) => {
          const row = byStart.get(p.periodStart) as any;
          return !row?.paid_at || Number(row.total_amount || 0) + 0.01 < p.total;
        })
        .map((p) => {
          const row = byStart.get(p.periodStart) as any;
          const missing = Math.round((p.total - Number(row?.total_amount || 0)) * 100) / 100;
          return { period: new Date(`${p.periodStart}T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }), amount: missing };
        });

      if (unpaidRows.length === 0) {
        throw new Error("Aucun impayé détecté sur cette période pour ce bail — vérifie la situation avant d'envoyer une mise en demeure.");
      }

      const totalAmount = Math.round(unpaidRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      const todayISO = new Date().toISOString().slice(0, 10);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 8);
      const signaturePlace = args.signature_place || property?.city || "";
      if (!signaturePlace) throw new Error("Indique la ville depuis laquelle envoyer ce courrier (lieu de signature).");

      const data = await callInternalApi(ctx, "/api/lease-contracts/generate-mise-en-demeure", {
        userId: ctx.userId,
        tenantName: tenant?.full_name || "Locataire",
        propertyAddress,
        unpaidRows,
        totalAmount,
        deadlineDate: deadline.toISOString().slice(0, 10),
        signaturePlace,
        signatureDate: todayISO,
      });
      return { ...data, unpaid_rows: unpaidRows, total_amount: totalAmount };
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      rows.push({ label: "Document", value: "Mise en demeure de payer (PDF), montants calculés depuis les paiements réels" });
      return rows;
    },
  },
  {
    name: "generate_conge",
    description: "Génère une lettre de congé bailleur (PDF) : reprise, vente ou motif légitime. Effet légal fort et délais de préavis stricts — ne jamais inventer le motif, le bénéficiaire ou le prix de vente : les demander explicitement à l'utilisateur si absents. Toujours confirmer avec l'utilisateur la date d'effet exacte du congé (échéance ou anniversaire du bail) avant d'appeler cet outil.",
    input_schema: {
      type: "object",
      properties: {
        lease_id: { type: "string" },
        kind: { type: "string", enum: ["reprise", "vente", "motif"] },
        lease_end_date: { type: "string", description: "Date d'effet du congé (échéance/anniversaire du bail), YYYY-MM-DD — à confirmer explicitement avec l'utilisateur, jamais devinée." },
        signature_place: { type: "string", description: "Ville depuis laquelle le courrier est signé. Par défaut la ville du bien." },
        beneficiary_name: { type: "string", description: "Obligatoire si kind='reprise'." },
        beneficiary_relationship: { type: "string", description: "Lien avec le bailleur (kind='reprise')." },
        beneficiary_current_address: { type: "string" },
        sale_price: { type: "number", description: "Obligatoire si kind='vente'." },
        sale_conditions: { type: "string" },
        motif_description: { type: "string", description: "Obligatoire si kind='motif' : description précise et réelle donnée par l'utilisateur, jamais inventée." },
      },
      required: ["lease_id", "kind", "lease_end_date"],
    },
    mutates: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin
        .from("leases")
        .select("id,property_id,lot_id,tenant_id,start_date,lease_kind")
        .eq("id", args.lease_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");

      const kind = String(args.kind);
      if (!["reprise", "vente", "motif"].includes(kind)) throw new Error("Motif de congé invalide.");
      if (kind === "reprise" && !args.beneficiary_name) throw new Error("Le nom du bénéficiaire de la reprise est requis.");
      if (kind === "vente" && !args.sale_price) throw new Error("Le prix de vente est requis pour un congé pour vente.");
      if (kind === "motif" && !args.motif_description) throw new Error("La description précise du motif légitime est requise.");

      const { data: tenant } = await admin.from("tenants").select("full_name").eq("id", lease.tenant_id).eq("user_id", ctx.userId).maybeSingle();
      const propertyAddress = await resolvePropertyAddress(admin, ctx.userId, lease.property_id, lease.lot_id);
      const { data: property } = await admin.from("properties").select("city").eq("id", lease.property_id).eq("user_id", ctx.userId).maybeSingle();
      const signaturePlace = args.signature_place || property?.city || "";
      if (!signaturePlace) throw new Error("Indique la ville depuis laquelle envoyer ce courrier (lieu de signature).");

      const data = await callInternalApi(ctx, "/api/lease-contracts/generate-conge", {
        userId: ctx.userId,
        leaseId: args.lease_id,
        kind,
        tenantName: tenant?.full_name || "Locataire",
        propertyAddress,
        leaseStartDate: lease.start_date,
        leaseEndDate: args.lease_end_date,
        bailType: lease.lease_kind,
        signaturePlace,
        signatureDate: new Date().toISOString().slice(0, 10),
        beneficiaryName: args.beneficiary_name,
        beneficiaryRelationship: args.beneficiary_relationship,
        beneficiaryCurrentAddress: args.beneficiary_current_address,
        salePrice: args.sale_price != null ? Number(args.sale_price) : undefined,
        saleConditions: args.sale_conditions,
        motifDescription: args.motif_description,
      });
      return data;
    },
    summarize: async (ctx, args) => {
      const admin = requireAdmin();
      const leaseInfo = await resolveLeaseSummary(admin, ctx.userId, args.lease_id);
      const rows: Array<{ label: string; value: string }> = [];
      if (leaseInfo) {
        rows.push({ label: "Bien", value: leaseInfo.propertyLabel });
        rows.push({ label: "Locataire", value: leaseInfo.tenantName });
      }
      rows.push({ label: "Motif", value: { reprise: "Reprise du logement", vente: "Vente du logement", motif: "Motif légitime et sérieux" }[String(args.kind)] || String(args.kind) });
      rows.push({ label: "Date d'effet", value: String(args.lease_end_date || "—") });
      if (args.kind === "reprise" && args.beneficiary_name) rows.push({ label: "Bénéficiaire", value: String(args.beneficiary_name) });
      if (args.kind === "vente" && args.sale_price != null) rows.push({ label: "Prix de vente", value: euro(args.sale_price) });
      if (args.kind === "motif" && args.motif_description) rows.push({ label: "Motif détaillé", value: String(args.motif_description) });
      return rows;
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
    description: "Ouvre la section état des lieux pour un bail déjà créé, prêt à réaliser l'état des lieux d'entrée ou de sortie. À proposer après la création d'un bail, ou si l'utilisateur demande à faire un état des lieux. Renvoie edl_delegated=true si le bien est délégué à une agence (bail_edl) : dans ce cas, dis clairement à l'utilisateur que la saisie guidée est désactivée pour ce bien et que seul l'import du PDF fourni par l'agence est possible — ne dis jamais qu'il pourra 'créer' l'état des lieux normalement.",
    input_schema: {
      type: "object",
      properties: { lease_id: { type: "string" } },
      required: ["lease_id"],
    },
    mutates: false,
    navigate: true,
    execute: async (ctx, args) => {
      const admin = requireAdmin();
      const { data: lease } = await admin.from("leases").select("id,property_id").eq("id", args.lease_id).eq("user_id", ctx.userId).maybeSingle();
      if (!lease) throw new Error("Bail introuvable ou non autorisé.");
      const { data: property } = await admin
        .from("properties")
        .select("delegated_services,delegation_agency_name")
        .eq("id", lease.property_id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      const edlDelegated = !!property?.delegated_services?.includes("bail_edl");
      return {
        edl_delegated: edlDelegated,
        delegation_agency_name: edlDelegated ? property?.delegation_agency_name || null : null,
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
