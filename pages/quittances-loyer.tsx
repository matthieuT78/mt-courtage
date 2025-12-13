// pages/quittances-loyer.tsx
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = { id: string; email?: string };

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

// Tables (alignées avec ton schéma)
type Property = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  created_at?: string;
  updated_at?: string;
};

type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;

  start_date: string; // NOT NULL
  end_date: string | null;

  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;

  payment_day: number | null; // smallint
  payment_method: string | null;
  status: string | null;

  auto_quittance_enabled: boolean;
  tenant_receipt_email: string | null;
  timezone: string | null;

  auto_send_frequency: string | null; // ex: monthly | weekly | quarterly
  auto_send_day: number | null; // smallint (1-31 ou 1-7 selon ta logique)
  auto_send_hour: number | null; // smallint
  created_at?: string;
  updated_at?: string;
};

type RentReceipt = {
  id: string;
  lease_id: string;
  payment_id: string | null;
  period_start: string; // date
  period_end: string; // date
  rent_amount: number | null;
  charges_amount: number | null;
  total_amount: number | null;
  issue_date: string | null; // date
  issue_place: string | null;
  issued_at: string | null;
  content_text: string | null;
  pdf_url: string | null;
  sent_to_tenant_email: string | null;
  sent_at: string | null;
  created_at: string;
};

type Landlord = {
  user_id: string;
  display_name: string | null;
  address: string | null;

  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;

  default_issue_place: string | null;
  default_payment_method: string | null;

  auto_send_enabled: boolean | null;
  auto_send_frequency: string | null;
  auto_send_day: number | null;
  auto_send_hour: number | null;
};

// -------------------------
// Helpers
// -------------------------
const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const toMonthISO = (d: Date) => d.toISOString().slice(0, 7);

const formatDateFR = (val?: string | null) => {
  if (!val) return "";
  const d = new Date(val + "T00:00:00");
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
};

const getMonthPeriodFromYYYYMM = (yyyymm: string) => {
  const [yStr, mStr] = yyyymm.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start, end };
};

const toDateOnly = (val: string) => new Date(val + "T00:00:00");
const isAfterOrEqual = (a: Date, b: Date) => a.getTime() >= b.getTime();
const isBeforeOrEqual = (a: Date, b: Date) => a.getTime() <= b.getTime();

const buildPropertyAddress = (p: Property | null) => {
  if (!p) return "";
  const parts = [
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country,
  ]
    .filter(Boolean)
    .join("\n");
  return parts.trim();
};

const buildLandlordAddress = (l: Landlord | null) => {
  if (!l) return "";
  const parts = [
    l.address_line1 || l.address || null,
    l.address_line2,
    [l.postal_code, l.city].filter(Boolean).join(" "),
    l.country,
  ]
    .filter(Boolean)
    .join("\n");
  return parts.trim();
};

function generateQuittanceText(params: {
  bailleurNom: string;
  bailleurAdresse?: string | null;
  locataireNom: string;
  bienAdresse?: string | null;
  loyerHC: number;
  charges: number;
  periodeDebut: string;
  periodeFin: string;
  villeQuittance?: string | null;
  dateQuittance?: string | null;
  modePaiement: PaymentMode;
  mentionSolde: boolean;
}) {
  const {
    bailleurNom,
    bailleurAdresse,
    locataireNom,
    bienAdresse,
    loyerHC,
    charges,
    periodeDebut,
    periodeFin,
    villeQuittance,
    dateQuittance,
    modePaiement,
    mentionSolde,
  } = params;

  const total = (loyerHC || 0) + (charges || 0);

  const periodeStr =
    periodeDebut && periodeFin
      ? `pour la période du ${formatDateFR(periodeDebut)} au ${formatDateFR(periodeFin)}`
      : "";

  const villeDateStr =
    villeQuittance && dateQuittance ? `${villeQuittance}, le ${formatDateFR(dateQuittance)}` : "";

  const modePaiementLabel =
    modePaiement === "virement"
      ? "par virement bancaire"
      : modePaiement === "cheque"
      ? "par chèque"
      : modePaiement === "especes"
      ? "en espèces"
      : "par prélèvement";

  const lignes: string[] = [];

  lignes.push(bailleurNom || "Nom du bailleur");
  if (bailleurAdresse) lignes.push(bailleurAdresse);
  lignes.push("");

  lignes.push(`À l'attention de : ${locataireNom || "Locataire"}`);
  lignes.push("");

  lignes.push("QUITTANCE DE LOYER");
  lignes.push("".padEnd(22, "="));
  lignes.push("");

  lignes.push(
    `Je soussigné(e) ${bailleurNom || "[Nom du bailleur]"}, propriétaire du logement situé ${
      bienAdresse || "[Adresse du logement]"
    }, certifie avoir reçu de la part de ${locataireNom || "[Nom du locataire]"} la somme de ${formatEuro(
      total
    )} (${formatEuro(loyerHC)} de loyer hors charges et ${formatEuro(charges)} de provisions sur charges) ${
      periodeStr ? periodeStr : ""
    }, ${modePaiementLabel}.`
  );

  lignes.push("");

  if (mentionSolde) {
    lignes.push(
      "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette de locataire envers le bailleur pour ladite période."
    );
    lignes.push("");
  }

  lignes.push(
    "La présente quittance ne préjuge en rien du paiement des loyers et charges antérieurs ou ultérieurs non quittancés."
  );
  lignes.push("");

  if (villeDateStr) {
    lignes.push(villeDateStr);
    lignes.push("");
  }

  lignes.push("Signature du bailleur :");
  lignes.push("");
  lignes.push("____________________________________");

  return lignes.join("\n");
}

// -------------------------
// Auth hook (robuste)
// -------------------------
function useAuthedUser() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

// -------------------------
// Page
// -------------------------
export default function QuittancesLoyerPage() {
  const router = useRouter();
  const { user, loading: loadingUser } = useAuthedUser();

  // Data
  const [landlord, setLandlord] = useState<Landlord | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [receipts, setReceipts] = useState<RentReceipt[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Selection
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const selectedLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId) || null,
    [leases, selectedLeaseId]
  );

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const selectedReceipt = useMemo(
    () => receipts.find((r) => r.id === selectedReceiptId) || null,
    [receipts, selectedReceiptId]
  );

  // Form (unique) : Property + Tenant + Lease + Auto-send + Preview
  const [propertyId, setPropertyId] = useState<string>(""); // "" = nouveau
  const [propertyLabel, setPropertyLabel] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  const [tenantId, setTenantId] = useState<string>(""); // "" = nouveau
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");

  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [endDate, setEndDate] = useState<string>("");

  const [rent, setRent] = useState<string>("");
  const [charges, setCharges] = useState<string>("");
  const [deposit, setDeposit] = useState<string>("");

  const [paymentDay, setPaymentDay] = useState<string>("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>("virement");
  const [leaseStatus, setLeaseStatus] = useState<string>("active");

  const [autoEnabled, setAutoEnabled] = useState<boolean>(true);
  const [autoFreq, setAutoFreq] = useState<string>("monthly"); // monthly|weekly|quarterly
  const [autoDay, setAutoDay] = useState<string>("1"); // jour du mois (1-31)
  const [autoHour, setAutoHour] = useState<string>("9"); // 09h

  const [periodMonth, setPeriodMonth] = useState(() => toMonthISO(new Date())); // YYYY-MM
  const [mentionSolde, setMentionSolde] = useState(true);

  const [savingLease, setSavingLease] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Maps for UI joins
  const propertiesById = useMemo(() => {
    const m = new Map<string, Property>();
    properties.forEach((p) => m.set(p.id, p));
    return m;
  }, [properties]);

  const tenantsById = useMemo(() => {
    const m = new Map<string, Tenant>();
    tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [tenants]);

  const leaseLabel = useCallback(
    (l: Lease) => {
      const p = propertiesById.get(l.property_id) || null;
      const t = tenantsById.get(l.tenant_id) || null;
      const pName = p?.label || "Bien";
      const tName = t?.full_name || "Locataire";
      return `${pName} — ${tName}`;
    },
    [propertiesById, tenantsById]
  );

  const receiptLabel = useCallback(
    (r: RentReceipt) => {
      const l = leases.find((x) => x.id === r.lease_id) || null;
      const base = l ? leaseLabel(l) : "Bail";
      return `${base} · ${r.period_start} → ${r.period_end}`;
    },
    [leases, leaseLabel]
  );

  const resetForm = () => {
    setSelectedLeaseId(null);
    setSelectedReceiptId(null);

    setPropertyId("");
    setPropertyLabel("");
    setAddress1("");
    setAddress2("");
    setPostalCode("");
    setCity("");
    setCountry("France");

    setTenantId("");
    setTenantName("");
    setTenantEmail("");
    setTenantPhone("");

    setStartDate(toISODate(new Date()));
    setEndDate("");

    setRent("");
    setCharges("");
    setDeposit("");

    setPaymentDay("1");
    setPaymentMethod("virement");
    setLeaseStatus("active");

    setAutoEnabled(true);
    setAutoFreq("monthly");
    setAutoDay("1");
    setAutoHour("9");

    setMessage(null);
    setErrorData(null);
  };

  // Load all
  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setErrorData(null);
    setMessage(null);

    try {
      // landlord (optionnel)
      const { data: lData } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setLandlord((lData as Landlord) || null);

      // properties / tenants / leases
      const [pRes, tRes, leaseRes] = await Promise.all([
        supabase.from("properties").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("tenants").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("leases").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);

      if (pRes.error) throw pRes.error;
      if (tRes.error) throw tRes.error;
      if (leaseRes.error) throw leaseRes.error;

      const p = (pRes.data || []) as Property[];
      const t = (tRes.data || []) as Tenant[];
      const l = (leaseRes.data || []) as Lease[];

      setProperties(p);
      setTenants(t);
      setLeases(l);

      // receipts: via lease ids
      const leaseIds = l.map((x) => x.id);
      if (leaseIds.length === 0) {
        setReceipts([]);
      } else {
        const rr = await supabase
          .from("rent_receipts")
          .select("*")
          .in("lease_id", leaseIds)
          .order("created_at", { ascending: false })
          .limit(80);

        if (rr.error) throw rr.error;
        setReceipts((rr.data || []) as RentReceipt[]);
      }
    } catch (err: any) {
      setErrorData(err?.message || "Impossible de charger les données (baux/quittances).");
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshAll();
  }, [user, refreshAll]);

  // Load form when selecting a lease
  useEffect(() => {
    setMessage(null);
    setErrorData(null);

    if (!selectedLease) return;

    const p = propertiesById.get(selectedLease.property_id) || null;
    const t = tenantsById.get(selectedLease.tenant_id) || null;

    setPropertyId(p?.id || "");
    setPropertyLabel(p?.label || "");
    setAddress1(p?.address_line1 || "");
    setAddress2(p?.address_line2 || "");
    setPostalCode(p?.postal_code || "");
    setCity(p?.city || "");
    setCountry(p?.country || "France");

    setTenantId(t?.id || "");
    setTenantName(t?.full_name || "");
    setTenantEmail(t?.email || selectedLease.tenant_receipt_email || "");
    setTenantPhone(t?.phone || "");

    setStartDate(selectedLease.start_date || toISODate(new Date()));
    setEndDate(selectedLease.end_date || "");

    setRent(selectedLease.rent_amount != null ? String(selectedLease.rent_amount) : "");
    setCharges(selectedLease.charges_amount != null ? String(selectedLease.charges_amount) : "");
    setDeposit(selectedLease.deposit_amount != null ? String(selectedLease.deposit_amount) : "");

    setPaymentDay(selectedLease.payment_day != null ? String(selectedLease.payment_day) : "1");
    setPaymentMethod(((selectedLease.payment_method as any) || "virement") as PaymentMode);
    setLeaseStatus(selectedLease.status || "active");

    setAutoEnabled(!!selectedLease.auto_quittance_enabled);
    setAutoFreq(selectedLease.auto_send_frequency || "monthly");
    setAutoDay(selectedLease.auto_send_day != null ? String(selectedLease.auto_send_day) : "1");
    setAutoHour(selectedLease.auto_send_hour != null ? String(selectedLease.auto_send_hour) : "9");
  }, [selectedLease, propertiesById, tenantsById]);

  // Choose property / tenant from dropdown -> fill fields
  useEffect(() => {
    if (!propertyId) return;
    const p = propertiesById.get(propertyId);
    if (!p) return;
    setPropertyLabel(p.label || "");
    setAddress1(p.address_line1 || "");
    setAddress2(p.address_line2 || "");
    setPostalCode(p.postal_code || "");
    setCity(p.city || "");
    setCountry(p.country || "France");
  }, [propertyId, propertiesById]);

  useEffect(() => {
    if (!tenantId) return;
    const t = tenantsById.get(tenantId);
    if (!t) return;
    setTenantName(t.full_name || "");
    setTenantEmail(t.email || "");
    setTenantPhone(t.phone || "");
  }, [tenantId, tenantsById]);

  // Preview text (live)
  const previewText = useMemo(() => {
    const bailleurNom = landlord?.display_name || user?.email || "Bailleur";
    const bailleurAdresse = buildLandlordAddress(landlord);

    const p: Property | null = propertyId ? propertiesById.get(propertyId) || null : null;
    const t: Tenant | null = tenantId ? tenantsById.get(tenantId) || null : null;

    const bienAdresse = buildPropertyAddress(
      p || {
        id: "temp",
        user_id: user?.id || "",
        label: propertyLabel || null,
        address_line1: address1 || null,
        address_line2: address2 || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || null,
      }
    );

    const locataireNom = (t?.full_name || tenantName || "Locataire").trim();

    const rentNum = parseFloat(rent || "0") || 0;
    const chargesNum = parseFloat(charges || "0") || 0;

    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);

    const issuePlace = landlord?.default_issue_place || city || "";
    const issueDate = toISODate(new Date());

    return generateQuittanceText({
      bailleurNom,
      bailleurAdresse,
      locataireNom,
      bienAdresse,
      loyerHC: rentNum,
      charges: chargesNum,
      periodeDebut: toISODate(start),
      periodeFin: toISODate(end),
      villeQuittance: issuePlace,
      dateQuittance: issueDate,
      modePaiement: paymentMethod,
      mentionSolde,
    });
  }, [
    landlord,
    user,
    propertyId,
    propertiesById,
    tenantId,
    tenantsById,
    propertyLabel,
    address1,
    address2,
    postalCode,
    city,
    country,
    tenantName,
    rent,
    charges,
    periodMonth,
    paymentMethod,
    mentionSolde,
  ]);

  // Click receipt -> show its text (if stored)
  const receiptTextToShow = useMemo(() => {
    if (selectedReceipt?.content_text) return selectedReceipt.content_text;
    return previewText;
  }, [selectedReceipt, previewText]);

  // Create/update lease + (maybe) property/tenant
  const handleSaveLease = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingLease(true);
    setMessage(null);
    setErrorData(null);

    try {
      // Validations minimales
      if (!startDate) throw new Error("La date de début du bail est obligatoire.");
      if (!propertyLabel.trim()) throw new Error("Merci de renseigner un nom de bien.");
      if (!address1.trim() || !postalCode.trim() || !city.trim()) {
        throw new Error("Merci de renseigner l’adresse (ligne 1), le code postal et la ville du bien.");
      }
      if (!tenantName.trim()) throw new Error("Merci de renseigner le nom du locataire.");

      const rentNum = parseFloat(rent || "0") || 0;
      const chargesNum = parseFloat(charges || "0") || 0;
      const depositNum = deposit ? parseFloat(deposit || "0") || 0 : null;

      const payDayNum = Math.min(31, Math.max(1, parseInt(paymentDay || "1", 10) || 1));
      const autoDayNum = Math.min(31, Math.max(1, parseInt(autoDay || "1", 10) || 1));
      const autoHourNum = Math.min(23, Math.max(0, parseInt(autoHour || "9", 10) || 9));

      // 1) Upsert Property
      let finalPropertyId = propertyId;
      if (finalPropertyId) {
        const { error } = await supabase
          .from("properties")
          .update({
            label: propertyLabel.trim(),
            address_line1: address1.trim(),
            address_line2: address2.trim() || null,
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: (country || "France").trim(),
          })
          .eq("id", finalPropertyId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("properties")
          .insert({
            user_id: user.id,
            label: propertyLabel.trim(),
            address_line1: address1.trim(),
            address_line2: address2.trim() || null,
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: (country || "France").trim(),
          })
          .select()
          .single();
        if (error) throw error;
        finalPropertyId = (data as Property).id;
      }

      // 2) Upsert Tenant
      let finalTenantId = tenantId;
      if (finalTenantId) {
        const { error } = await supabase
          .from("tenants")
          .update({
            full_name: tenantName.trim(),
            email: tenantEmail.trim() || null,
            phone: tenantPhone.trim() || null,
          })
          .eq("id", finalTenantId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tenants")
          .insert({
            user_id: user.id,
            full_name: tenantName.trim(),
            email: tenantEmail.trim() || null,
            phone: tenantPhone.trim() || null,
            notes: null,
          })
          .select()
          .single();
        if (error) throw error;
        finalTenantId = (data as Tenant).id;
      }

      // 3) Upsert Lease
      const payload = {
        user_id: user.id,
        property_id: finalPropertyId,
        tenant_id: finalTenantId,

        start_date: startDate,
        end_date: endDate || null,

        rent_amount: rentNum,
        charges_amount: chargesNum,
        deposit_amount: depositNum,

        payment_day: payDayNum,
        payment_method: paymentMethod,
        status: leaseStatus,

        auto_quittance_enabled: !!autoEnabled,
        tenant_receipt_email: (tenantEmail.trim() || null) as any,
        timezone: "Europe/Paris",

        auto_send_frequency: autoEnabled ? autoFreq : null,
        auto_send_day: autoEnabled ? autoDayNum : null,
        auto_send_hour: autoEnabled ? autoHourNum : null,
      };

      if (selectedLeaseId) {
        const { error } = await supabase
          .from("leases")
          .update(payload)
          .eq("id", selectedLeaseId)
          .eq("user_id", user.id);
        if (error) throw error;
        setMessage("Bail mis à jour ✅");
      } else {
        const { data, error } = await supabase.from("leases").insert(payload).select().single();
        if (error) throw error;
        setSelectedLeaseId((data as Lease).id);
        setMessage("Bail créé ✅");
      }

      await refreshAll();
    } catch (err: any) {
      setErrorData(err?.message || "Erreur lors de l’enregistrement du bail.");
    } finally {
      setSavingLease(false);
    }
  };

  // Generate + save receipt
  const handleGenerateAndSaveReceipt = async () => {
    if (!user) return;
    if (!selectedLease) {
      setErrorData("Sélectionnez un bail avant de générer une quittance.");
      return;
    }

    setGenerating(true);
    setMessage(null);
    setErrorData(null);

    try {
      // Validation période vs bail
      const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);
      const leaseStart = selectedLease.start_date ? toDateOnly(selectedLease.start_date) : null;
      const leaseEnd = selectedLease.end_date ? toDateOnly(selectedLease.end_date) : null;

      if (leaseStart && !isAfterOrEqual(end, leaseStart)) {
        throw new Error("Impossible : le bail commence après la période de quittance.");
      }
      if (leaseEnd && !isBeforeOrEqual(start, leaseEnd)) {
        throw new Error("Impossible : le bail est terminé avant la période de quittance.");
      }

      // Montants
      const rentNum = parseFloat(rent || "0") || 0;
      const chargesNum = parseFloat(charges || "0") || 0;
      const total = rentNum + chargesNum;

      const issuePlace = landlord?.default_issue_place || city || null;
      const issueDate = toISODate(new Date());

      // Texte = preview live
      const text = previewText;

      // Option : éviter doublon (même lease + même période)
      const existing = receipts.find(
        (r) => r.lease_id === selectedLease.id && r.period_start === toISODate(start) && r.period_end === toISODate(end)
      );
      if (existing) {
        throw new Error("Une quittance existe déjà pour ce bail et cette période.");
      }

      const { data, error } = await supabase
        .from("rent_receipts")
        .insert({
          lease_id: selectedLease.id,
          payment_id: null,
          period_start: toISODate(start),
          period_end: toISODate(end),

          rent_amount: rentNum,
          charges_amount: chargesNum,
          total_amount: total,

          issue_date: issueDate,
          issue_place: issuePlace,
          issued_at: new Date().toISOString(),

          content_text: text,
          pdf_url: null,

          sent_to_tenant_email: tenantEmail.trim() || null,
          sent_at: null,
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as RentReceipt;

      setReceipts((prev) => [created, ...prev]);
      setSelectedReceiptId(created.id);
      setMessage("Quittance générée et enregistrée ✅");
    } catch (err: any) {
      setErrorData(err?.message || "Erreur lors de la génération/enregistrement.");
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------
  // UI: not logged in
  // -------------------------
  if (!loadingUser && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">Quittances de loyer</p>
            <h1 className="text-lg font-semibold text-slate-900">Connectez-vous pour gérer vos quittances</h1>
            <p className="text-sm text-slate-600">
              Cet outil nécessite un compte pour stocker vos baux, vos quittances et l’historique.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/mon-compte?mode=login&redirect=/quittances-loyer")}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Me connecter
              </button>
              <button
                type="button"
                onClick={() => router.push("/mon-compte?mode=register&redirect=/quittances-loyer")}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------
  // UI: main
  // -------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">Quittances de loyer</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Baux + quittances enregistrées + preview + auto-envoi
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Ici, vous créez un <span className="font-semibold">bail</span> (bien + locataire + conditions),
              puis vous générez une quittance mensuelle liée à ce bail.
            </p>

            {errorData && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorData}
              </div>
            )}
            {message && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {message}
              </div>
            )}
            {loadingData && <p className="text-xs text-slate-500">Chargement…</p>}
          </section>

          <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
            {/* LEFT: Receipts list */}
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Quittances enregistrées</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceiptId(null);
                    setMessage(null);
                    setErrorData(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Preview modèle
                </button>
              </div>

              {receipts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[0.75rem] text-slate-600">
                  Aucune quittance enregistrée. Sélectionnez un bail puis cliquez sur{" "}
                  <span className="font-semibold">“Générer & enregistrer”</span>.
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {receipts.map((r) => {
                    const active = r.id === selectedReceiptId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedReceiptId(r.id)}
                        className={
                          "w-full text-left rounded-xl border px-3 py-2 text-xs transition " +
                          (active
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                        }
                      >
                        <p className="font-semibold text-slate-900 line-clamp-2">{receiptLabel(r)}</p>
                        <p className="text-[0.7rem] text-slate-500 mt-1">
                          Total : <span className="font-semibold">{formatEuro(r.total_amount)}</span> · créée le{" "}
                          {r.created_at.slice(0, 10)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* RIGHT: Lease select + form + preview */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              {/* Lease select */}
              <div className="grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Bail (bien + locataire)</label>
                  <select
                    value={selectedLeaseId || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedReceiptId(null);
                      setSelectedLeaseId(v || null);
                      setMessage(null);
                      setErrorData(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">— Créer un nouveau bail —</option>
                    {leases.map((l) => (
                      <option key={l.id} value={l.id}>
                        {leaseLabel(l)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[0.7rem] text-slate-500">
                    Le bail est ce qui “débloque” les quittances (il relie un bien et un locataire).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Nouveau bail
                </button>
              </div>

              {/* Form unique */}
              <form onSubmit={handleSaveLease} className="space-y-4">
                {/* Property */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Bien (properties)</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Bien existant (optionnel)</label>
                      <select
                        value={propertyId}
                        onChange={(e) => setPropertyId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">— Nouveau bien —</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label || "Bien"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Nom du bien</label>
                      <input
                        type="text"
                        value={propertyLabel}
                        onChange={(e) => setPropertyLabel(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ex: Studio Paris 15"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Adresse (ligne 1)</label>
                      <input
                        type="text"
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Adresse (ligne 2)</label>
                      <input
                        type="text"
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Code postal</label>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Ville</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Pays</label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Tenant */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Locataire (tenants)</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Locataire existant (optionnel)</label>
                      <select
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">— Nouveau locataire —</option>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name || "Locataire"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Nom complet</label>
                      <input
                        type="text"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Email (pour envoi quittance)</label>
                      <input
                        type="email"
                        value={tenantEmail}
                        onChange={(e) => setTenantEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Téléphone</label>
                      <input
                        type="text"
                        value={tenantPhone}
                        onChange={(e) => setTenantPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Lease */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Bail (leases)</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Début du bail (obligatoire)</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Fin du bail (optionnel)</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Loyer HC (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rent}
                        onChange={(e) => setRent(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={charges}
                        onChange={(e) => setCharges(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Dépôt de garantie (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={deposit}
                        onChange={(e) => setDeposit(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Jour de paiement (1–31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={paymentDay}
                        onChange={(e) => setPaymentDay(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Mode de paiement</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMode)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="virement">Virement</option>
                        <option value="prelevement">Prélèvement</option>
                        <option value="cheque">Chèque</option>
                        <option value="especes">Espèces</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Statut</label>
                      <select
                        value={leaseStatus}
                        onChange={(e) => setLeaseStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="active">Actif</option>
                        <option value="paused">Suspendu</option>
                        <option value="ended">Terminé</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Auto send */}
                <div className="rounded-xl border border-slate-200 bg-amber-50/60 p-4 space-y-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Envoi automatique (bail)</p>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={autoEnabled}
                      onChange={(e) => setAutoEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                    />
                    <span>Activer l’envoi automatique des quittances</span>
                  </label>

                  {autoEnabled && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Fréquence</label>
                        <select
                          value={autoFreq}
                          onChange={(e) => setAutoFreq(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="monthly">Mensuel</option>
                          <option value="weekly">Hebdomadaire</option>
                          <option value="quarterly">Trimestriel</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Jour (mensuel = 1–31)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={autoDay}
                          onChange={(e) => setAutoDay(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Heure (0–23)</label>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={autoHour}
                          onChange={(e) => setAutoHour(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <p className="text-[0.7rem] text-slate-600">Défaut : 09h</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save */}
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="submit"
                    disabled={savingLease}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingLease ? "Enregistrement…" : selectedLeaseId ? "Mettre à jour le bail" : "Créer le bail"}
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAndSaveReceipt}
                    disabled={generating || !selectedLeaseId}
                    className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                    title={!selectedLeaseId ? "Créez ou sélectionnez un bail d'abord." : ""}
                  >
                    {generating ? "Génération…" : "Générer & enregistrer la quittance"}
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-[0.7rem] text-slate-700">Période</label>
                    <input
                      type="month"
                      value={periodMonth}
                      onChange={(e) => {
                        setSelectedReceiptId(null);
                        setPeriodMonth(e.target.value);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mentionSolde}
                    onChange={(e) => setMentionSolde(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Inclure la mention “solde de toute dette”</span>
                </label>
              </form>

              {/* Preview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      {selectedReceipt ? "Aperçu quittance enregistrée" : "Aperçu du modèle (live)"}
                    </p>
                    {selectedReceipt && (
                      <p className="text-[0.75rem] text-slate-600 mt-1">
                        {receiptLabel(selectedReceipt)}
                      </p>
                    )}
                  </div>

                  {selectedReceipt && (
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptId(null)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Revenir au modèle
                    </button>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-[420px] overflow-auto">
                  <pre className="whitespace-pre-wrap text-[0.8rem] text-slate-800 leading-relaxed">
                    {receiptTextToShow}
                  </pre>
                </div>

                {selectedReceipt && (
                  <div className="mt-3 text-[0.75rem] text-slate-600">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        Total : <span className="font-semibold">{formatEuro(selectedReceipt.total_amount)}</span>
                      </span>
                      <span>
                        Émise le : <span className="font-semibold">{selectedReceipt.issue_date || "—"}</span>
                      </span>
                      <span>
                        Lieu : <span className="font-semibold">{selectedReceipt.issue_place || "—"}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right">
                <a
                  href="/outils-proprietaire"
                  className="text-[0.75rem] text-slate-500 underline underline-offset-2"
                >
                  ← Retour à la boîte à outils propriétaire
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour propriétaires et investisseurs.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
