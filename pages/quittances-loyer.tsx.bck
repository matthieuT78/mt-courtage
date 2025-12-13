// pages/quittances-loyer.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

type LandlordRow = {
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
};

type PropertyRow = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
};

type TenantRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type LeaseRow = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string | null;
  end_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;
  payment_day: number | null;
  payment_method: string | null;
  status: string | null;

  auto_quittance_enabled: boolean;
  tenant_receipt_email: string | null;
  timezone: string | null;

  // ✅ à ajouter via SQL : auto_send_frequency/day/hour
  auto_send_frequency?: string | null;
  auto_send_day?: number | null;
  auto_send_hour?: number | null;

  created_at: string;
  updated_at: string | null;

  property?: PropertyRow | null;
  tenant?: TenantRow | null;
};

type RentReceiptRow = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  rent_amount: number | null;
  charges_amount: number | null;
  total_amount: number | null;
  issue_date: string | null;
  issue_place: string | null;
  content_text: string | null;
  created_at: string;
};

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateFR(val?: string | null) {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
}

function formatEuro(val: number | null | undefined) {
  if (val == null || Number.isNaN(val)) return "—";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMonthPeriod(base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start, end };
}

function compactAddress(p: {
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  const parts = [
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country,
  ].filter(Boolean);
  return parts.join("\n");
}

function paymentModeLabel(mode: PaymentMode) {
  switch (mode) {
    case "virement":
      return "par virement bancaire";
    case "cheque":
      return "par chèque";
    case "especes":
      return "en espèces";
    case "prelevement":
      return "par prélèvement";
  }
}

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

  const lignes: string[] = [];

  lignes.push(bailleurNom || "Nom du bailleur");
  if (bailleurAdresse) lignes.push(bailleurAdresse);
  lignes.push("");
  lignes.push(`À l'attention de : ${locataireNom || "Nom du locataire"}`);
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
    }, ${paymentModeLabel(modePaiement)}.`
  );

  lignes.push("");

  if (mentionSolde) {
    lignes.push(
      "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette du locataire envers le bailleur pour ladite période."
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
// Page
// -------------------------
export default function QuittancesLoyerPage() {
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);

  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);

  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  const currentLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId) || null,
    [leases, selectedLeaseId]
  );

  const [receipts, setReceipts] = useState<RentReceiptRow[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const currentReceipt = useMemo(
    () => receipts.find((r) => r.id === selectedReceiptId) || null,
    [receipts, selectedReceiptId]
  );

  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  // -------------------------
  // Form (bail unique)
  // -------------------------
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);

  // Bien
  const [pLabel, setPLabel] = useState("");
  const [pAddr1, setPAddr1] = useState("");
  const [pAddr2, setPAddr2] = useState("");
  const [pZip, setPZip] = useState("");
  const [pCity, setPCity] = useState("");
  const [pCountry, setPCountry] = useState("FR");

  // Locataire
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");

  // Bail
  const [rent, setRent] = useState("0");
  const [charges, setCharges] = useState("0");
  const [paymentDay, setPaymentDay] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>("virement");
  const [leaseStatus, setLeaseStatus] = useState("active");

  // Auto-envoi par bail
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoFreq, setAutoFreq] = useState<"monthly">("monthly");
  const [autoDay, setAutoDay] = useState("1");
  const [autoHour, setAutoHour] = useState("9");

  // Génération quittance
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [issuePlace, setIssuePlace] = useState("");
  const [issueDate, setIssueDate] = useState(() => toISODate(new Date()));
  const [mentionSolde, setMentionSolde] = useState(true);

  const bailleurDisplayName = useMemo(() => {
    return landlord?.display_name || userEmail || "Bailleur";
  }, [landlord, userEmail]);

  const bailleurAddress = useMemo(() => {
    if (landlord?.address) return landlord.address;
    const fromSplit = compactAddress({
      address_line1: landlord?.address_line1,
      address_line2: landlord?.address_line2,
      postal_code: landlord?.postal_code,
      city: landlord?.city,
      country: landlord?.country,
    });
    return fromSplit || "";
  }, [landlord]);

  // Preview
  const previewText = useMemo(() => {
    const [yy, mm] = periodMonth.split("-").map((x) => parseInt(x, 10));
    const base = new Date(yy, (mm || 1) - 1, 1);
    const { start, end } = getMonthPeriod(base);

    const loyer = parseFloat(rent || "0") || 0;
    const ch = parseFloat(charges || "0") || 0;

    const bienAdresse = compactAddress({
      address_line1: pAddr1,
      address_line2: pAddr2,
      postal_code: pZip,
      city: pCity,
      country: pCountry,
    });

    return generateQuittanceText({
      bailleurNom: bailleurDisplayName,
      bailleurAdresse: bailleurAddress || "",
      locataireNom: tName || "Locataire",
      bienAdresse,
      loyerHC: loyer,
      charges: ch,
      periodeDebut: toISODate(start),
      periodeFin: toISODate(end),
      villeQuittance: issuePlace || landlord?.default_issue_place || pCity || "",
      dateQuittance: issueDate || toISODate(new Date()),
      modePaiement: paymentMethod,
      mentionSolde,
    });
  }, [
    periodMonth,
    rent,
    charges,
    pAddr1,
    pAddr2,
    pZip,
    pCity,
    pCountry,
    tName,
    bailleurDisplayName,
    bailleurAddress,
    issuePlace,
    issueDate,
    paymentMethod,
    mentionSolde,
    landlord?.default_issue_place,
  ]);

  const resetForm = () => {
    setEditingLeaseId(null);

    setPLabel("");
    setPAddr1("");
    setPAddr2("");
    setPZip("");
    setPCity("");
    setPCountry("FR");

    setTName("");
    setTEmail("");

    setRent("0");
    setCharges("0");
    setPaymentDay("1");
    setPaymentMethod("virement");
    setLeaseStatus("active");

    setAutoEnabled(true);
    setAutoFreq("monthly");
    setAutoDay("1");
    setAutoHour("9");

    setIssueDate(toISODate(new Date()));
    setIssuePlace("");
    setMentionSolde(true);

    setGlobalErr(null);
    setGlobalMsg(null);
  };

  const loadFormFromLease = (l: LeaseRow) => {
    setEditingLeaseId(l.id);

    setPLabel(l.property?.label || "");
    setPAddr1(l.property?.address_line1 || "");
    setPAddr2(l.property?.address_line2 || "");
    setPZip(l.property?.postal_code || "");
    setPCity(l.property?.city || "");
    setPCountry(l.property?.country || "FR");

    setTName(l.tenant?.full_name || "");
    setTEmail((l.tenant_receipt_email || l.tenant?.email || "") as string);

    setRent(l.rent_amount != null ? String(l.rent_amount) : "0");
    setCharges(l.charges_amount != null ? String(l.charges_amount) : "0");
    setPaymentDay(l.payment_day != null ? String(l.payment_day) : "1");
    setPaymentMethod(((l.payment_method as any) || "virement") as PaymentMode);
    setLeaseStatus(l.status || "active");

    setAutoEnabled(!!l.auto_quittance_enabled);
    setAutoFreq((l.auto_send_frequency as any) === "monthly" ? "monthly" : "monthly");
    setAutoDay(l.auto_send_day != null ? String(l.auto_send_day) : String(l.payment_day ?? 1));
    setAutoHour(l.auto_send_hour != null ? String(l.auto_send_hour) : "9");

    setIssuePlace(landlord?.default_issue_place || l.property?.city || "");
    setGlobalErr(null);
    setGlobalMsg(null);
  };

  // -------------------------
  // Auth/session
  // -------------------------
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUserId(u?.id ?? null);
        setUserEmail(u?.email ?? null);
        setCheckingUser(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUserId(null);
        setUserEmail(null);
        setCheckingUser(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      setCheckingUser(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // -------------------------
  // Load landlord + leases + receipts
  // -------------------------
  const refreshLandlord = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      setLandlord((data as any) || null);

      // default issue place in UI
      setIssuePlace((data as any)?.default_issue_place || "");
    } catch (e) {
      setLandlord(null);
    }
  };

  const refreshLeases = async (uid: string) => {
    setLeasesLoading(true);
    setLeasesError(null);
    try {
      const { data, error } = await supabase
        .from("leases")
        .select(
          `
          *,
          property:properties(*),
          tenant:tenants(*)
        `
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as any as LeaseRow[];
      setLeases(rows);

      // UX: si aucun bail → on force le mode création
      if (!rows.length) {
        setSelectedLeaseId(null);
        setSelectedReceiptId(null);
        resetForm();
      } else {
        // garder sélection si possible, sinon prendre le dernier
        setSelectedLeaseId((prev) => prev && rows.some((x) => x.id === prev) ? prev : rows[0].id);
      }
    } catch (err: any) {
      setLeasesError(err?.message || "Impossible de charger vos baux.");
      setLeases([]);
    } finally {
      setLeasesLoading(false);
    }
  };

  const refreshReceipts = async (uid: string, leaseIds: string[]) => {
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      if (!leaseIds.length) {
        setReceipts([]);
        setSelectedReceiptId(null);
        return;
      }

      // rent_receipts n'a pas user_id : on filtre par lease_id IN (...)
      const { data, error } = await supabase
        .from("rent_receipts")
        .select("*")
        .in("lease_id", leaseIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const rows = (data || []) as any as RentReceiptRow[];
      setReceipts(rows);

      // si on a une quittance sélectionnée qui n'existe plus, on reset
      setSelectedReceiptId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : null));
    } catch (err: any) {
      setReceiptsError(err?.message || "Impossible de charger vos quittances.");
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      await refreshLandlord(userId);
      await refreshLeases(userId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refreshReceipts(
      userId,
      leases.map((l) => l.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, leases.length]);

  // -------------------------
  // UI: not logged in
  // -------------------------
  if (!checkingUser && !userId) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">
              Quittances de loyer
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Connectez-vous pour gérer vos quittances
            </h1>
            <p className="text-sm text-slate-600">
              Vous pourrez créer vos baux (bien + locataire) puis générer vos quittances et activer l’envoi automatique.
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
  // Actions: save lease (property+tenant+lease)
  // -------------------------
  const handleSaveLease = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setGlobalErr(null);
    setGlobalMsg(null);

    const rentNum = parseFloat(rent || "0") || 0;
    const chargesNum = parseFloat(charges || "0") || 0;

    const payDayNum = Math.min(31, Math.max(1, parseInt(paymentDay || "1", 10) || 1));
    const autoDayNum = Math.min(31, Math.max(1, parseInt(autoDay || String(payDayNum), 10) || payDayNum));
    const autoHourNum = Math.min(23, Math.max(0, parseInt(autoHour || "9", 10) || 9));

    // validations min
    if (!pLabel.trim()) return setGlobalErr("Merci de renseigner au minimum le nom du bien.");
    if (!pAddr1.trim() || !pZip.trim() || !pCity.trim()) {
      return setGlobalErr("Merci de renseigner l’adresse du bien (ligne 1, code postal, ville).");
    }
    if (!tName.trim()) return setGlobalErr("Merci de renseigner le nom du locataire.");
    if (!tEmail.trim()) return setGlobalErr("Merci de renseigner l’email du locataire (utile pour l’envoi auto).");

    try {
      // 1) property
      let propertyId = currentLease?.property_id || "";
      if (editingLeaseId && currentLease?.property_id) {
        const { error } = await supabase
          .from("properties")
          .update({
            label: pLabel.trim(),
            address_line1: pAddr1.trim(),
            address_line2: pAddr2.trim() || null,
            postal_code: pZip.trim(),
            city: pCity.trim(),
            country: (pCountry || "FR").trim(),
          })
          .eq("id", currentLease.property_id)
          .eq("user_id", userId);
        if (error) throw error;
        propertyId = currentLease.property_id;
      } else {
        const { data, error } = await supabase
          .from("properties")
          .insert({
            user_id: userId,
            label: pLabel.trim(),
            address_line1: pAddr1.trim(),
            address_line2: pAddr2.trim() || null,
            postal_code: pZip.trim(),
            city: pCity.trim(),
            country: (pCountry || "FR").trim(),
          })
          .select()
          .single();
        if (error) throw error;
        propertyId = (data as any).id;
      }

      // 2) tenant
      let tenantId = currentLease?.tenant_id || "";
      if (editingLeaseId && currentLease?.tenant_id) {
        const { error } = await supabase
          .from("tenants")
          .update({
            full_name: tName.trim(),
            email: tEmail.trim(),
          })
          .eq("id", currentLease.tenant_id)
          .eq("user_id", userId);
        if (error) throw error;
        tenantId = currentLease.tenant_id;
      } else {
        const { data, error } = await supabase
          .from("tenants")
          .insert({
            user_id: userId,
            full_name: tName.trim(),
            email: tEmail.trim(),
          })
          .select()
          .single();
        if (error) throw error;
        tenantId = (data as any).id;
      }

      // 3) lease
      const leasePayload: any = {
        user_id: userId,
        property_id: propertyId,
        tenant_id: tenantId,
        rent_amount: rentNum,
        charges_amount: chargesNum,
        payment_day: payDayNum,
        payment_method: paymentMethod,
        status: leaseStatus,
        auto_quittance_enabled: !!autoEnabled,
        tenant_receipt_email: tEmail.trim(),
        timezone: "Europe/Paris",

        // ✅ colonnes à ajouter via SQL
        auto_send_frequency: autoEnabled ? autoFreq : null,
        auto_send_day: autoEnabled ? autoDayNum : null,
        auto_send_hour: autoEnabled ? autoHourNum : null,
      };

      if (editingLeaseId) {
        const { error } = await supabase
          .from("leases")
          .update(leasePayload)
          .eq("id", editingLeaseId)
          .eq("user_id", userId);
        if (error) throw error;
        setGlobalMsg("Bail mis à jour ✅");
      } else {
        const { data, error } = await supabase
          .from("leases")
          .insert(leasePayload)
          .select()
          .single();
        if (error) throw error;
        const createdId = (data as any).id as string;
        setGlobalMsg("Bail créé ✅");
        setSelectedLeaseId(createdId);
        setEditingLeaseId(createdId);
      }

      await refreshLeases(userId);
      await refreshReceipts(userId, leases.map((l) => l.id));
    } catch (err: any) {
      // Si tu n'as pas encore ajouté les colonnes, tu verras une erreur "column ... does not exist"
      setGlobalErr(err?.message || "Erreur lors de l’enregistrement du bail.");
    }
  };

  // -------------------------
  // Action: generate & save receipt
  // -------------------------
  const handleSaveReceipt = async () => {
    if (!userId) return;
    if (!currentLease) return setGlobalErr("Sélectionnez un bail (ou créez-en un) avant de générer une quittance.");

    setGlobalErr(null);
    setGlobalMsg(null);

    try {
      const [yy, mm] = periodMonth.split("-").map((x) => parseInt(x, 10));
      const base = new Date(yy, (mm || 1) - 1, 1);
      const { start, end } = getMonthPeriod(base);

      const rentNum = currentLease.rent_amount || parseFloat(rent || "0") || 0;
      const chargesNum = currentLease.charges_amount || parseFloat(charges || "0") || 0;
      const total = rentNum + chargesNum;

      const bienAdresse = compactAddress({
        address_line1: currentLease.property?.address_line1 || pAddr1,
        address_line2: currentLease.property?.address_line2 || pAddr2,
        postal_code: currentLease.property?.postal_code || pZip,
        city: currentLease.property?.city || pCity,
        country: currentLease.property?.country || pCountry,
      });

      const txt = generateQuittanceText({
        bailleurNom: bailleurDisplayName,
        bailleurAdresse: bailleurAddress || "",
        locataireNom: currentLease.tenant?.full_name || tName || "Locataire",
        bienAdresse,
        loyerHC: rentNum,
        charges: chargesNum,
        periodeDebut: toISODate(start),
        periodeFin: toISODate(end),
        villeQuittance: issuePlace || landlord?.default_issue_place || currentLease.property?.city || "",
        dateQuittance: issueDate || toISODate(new Date()),
        modePaiement: ((currentLease.payment_method as any) || paymentMethod) as PaymentMode,
        mentionSolde,
      });

      const { data, error } = await supabase
        .from("rent_receipts")
        .insert({
          lease_id: currentLease.id,
          period_start: toISODate(start),
          period_end: toISODate(end),
          rent_amount: rentNum,
          charges_amount: chargesNum,
          total_amount: total,
          issue_date: issueDate || toISODate(new Date()),
          issue_place: issuePlace || landlord?.default_issue_place || currentLease.property?.city || "",
          content_text: txt,
          sent_to_tenant_email: currentLease.tenant_receipt_email || currentLease.tenant?.email || tEmail || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const created = data as any as RentReceiptRow;
      setReceipts((prev) => [created, ...prev]);
      setSelectedReceiptId(created.id);
      setGlobalMsg("Quittance enregistrée ✅");
    } catch (err: any) {
      setGlobalErr(err?.message || "Erreur lors de l’enregistrement de la quittance.");
    }
  };

  // -------------------------
  // UI
  // -------------------------
  const hasLeases = leases.length > 0;

  const leaseTitle = (l: LeaseRow) => {
    const p = l.property?.label || "Bien";
    const t = l.tenant?.full_name || "Locataire";
    return `${p} — ${t}`;
  };

  const receiptTitle = (r: RentReceiptRow) => {
    const lease = leases.find((l) => l.id === r.lease_id);
    const base = lease ? leaseTitle(lease) : "Bail";
    return `${base}`;
  };

  const receiptPreview = useMemo(() => {
    if (currentReceipt?.content_text) return currentReceipt.content_text;
    return previewText;
  }, [currentReceipt?.content_text, previewText]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* HEADER */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">
              Quittances de loyer
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Créez vos baux, générez vos quittances, et automatisez l’envoi.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Un <span className="font-semibold">bail</span> = un bien + un locataire + des conditions (loyer/charges/jour).
              Tant qu’il n’y a pas de bail, le générateur ne peut pas fonctionner.
            </p>

            {globalErr && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {globalErr}
              </div>
            )}
            {globalMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {globalMsg}
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
            {/* LEFT: receipts list */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 h-fit">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Quittances enregistrées
                </p>
                <p className="text-[0.75rem] text-slate-600">
                  Cliquez pour afficher l’aperçu.
                </p>
              </div>

              {receiptsLoading && <p className="text-xs text-slate-500">Chargement…</p>}
              {!receiptsLoading && receiptsError && (
                <p className="text-xs text-red-600">{receiptsError}</p>
              )}

              {!receiptsLoading && !receiptsError && receipts.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[0.75rem] text-slate-600">
                  Aucune quittance enregistrée pour l’instant.
                </div>
              )}

              {!receiptsLoading && receipts.length > 0 && (
                <div className="space-y-2">
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
                        <p className="font-semibold text-slate-900 line-clamp-1">
                          {receiptTitle(r)}
                        </p>
                        <p className="text-[0.7rem] text-slate-500">
                          Période {formatDateFR(r.period_start)} → {formatDateFR(r.period_end)}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-slate-600">
                          Total : <span className="font-semibold">{formatEuro(r.total_amount)}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RIGHT: main content */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
              {/* Bail selector / onboarding */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Bail (bien + locataire)
                  </p>
                  <p className="text-[0.75rem] text-slate-600">
                    {hasLeases ? "Sélectionnez un bail existant, ou créez-en un nouveau." : "Vous n’avez pas encore de bail. Créez le premier ci-dessous."}
                  </p>
                </div>

                <div className="flex gap-2">
                  {hasLeases && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setSelectedLeaseId(null);
                        setSelectedReceiptId(null);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      + Nouveau bail
                    </button>
                  )}
                </div>
              </div>

              {leasesLoading && <p className="text-xs text-slate-500">Chargement des baux…</p>}
              {!leasesLoading && leasesError && (
                <p className="text-xs text-red-600">{leasesError}</p>
              )}

              {hasLeases && (
                <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
                  <select
                    value={selectedLeaseId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setSelectedLeaseId(id);
                      setSelectedReceiptId(null);

                      const l = leases.find((x) => x.id === id);
                      if (l) loadFormFromLease(l);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {leases.map((l) => (
                      <option key={l.id} value={l.id}>
                        {leaseTitle(l)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentLease) return;
                      loadFormFromLease(currentLease);
                      setGlobalMsg("Bail chargé dans le formulaire.");
                    }}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Modifier ce bail
                  </button>
                </div>
              )}

              {/* Form bail unique */}
              <form onSubmit={handleSaveLease} className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    {editingLeaseId ? "Modifier le bail" : "Créer un bail"}
                  </p>

                  {/* Bien */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Nom du bien</label>
                      <input
                        value={pLabel}
                        onChange={(e) => setPLabel(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ex: Studio Paris 11"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Pays</label>
                      <input
                        value={pCountry}
                        onChange={(e) => setPCountry(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="FR"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Adresse (ligne 1)</label>
                    <input
                      value={pAddr1}
                      onChange={(e) => setPAddr1(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Ex: 12 rue ..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Adresse (ligne 2) – optionnel</label>
                    <input
                      value={pAddr2}
                      onChange={(e) => setPAddr2(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Bâtiment, étage, etc."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Code postal</label>
                      <input
                        value={pZip}
                        onChange={(e) => setPZip(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="75011"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Ville</label>
                      <input
                        value={pCity}
                        onChange={(e) => setPCity(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  {/* Locataire */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Nom du locataire</label>
                      <input
                        value={tName}
                        onChange={(e) => setTName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Nom Prénom"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Email du locataire</label>
                      <input
                        value={tEmail}
                        onChange={(e) => setTEmail(e.target.value)}
                        type="email"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="locataire@email.fr"
                      />
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Loyer HC (€)</label>
                      <input
                        value={rent}
                        onChange={(e) => setRent(e.target.value)}
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
                      <input
                        value={charges}
                        onChange={(e) => setCharges(e.target.value)}
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Jour paiement (1–31)</label>
                      <input
                        value={paymentDay}
                        onChange={(e) => setPaymentDay(e.target.value)}
                        type="number"
                        min={1}
                        max={31}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
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
                        <option value="paused">En pause</option>
                        <option value="ended">Terminé</option>
                      </select>
                    </div>
                  </div>

                  {/* Auto-envoi */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={autoEnabled}
                        onChange={(e) => setAutoEnabled(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                      />
                      <div>
                        <p className="text-[0.75rem] font-semibold text-slate-900">
                          Envoi automatique (par bail)
                        </p>
                        <p className="text-[0.75rem] text-slate-600">
                          Stocké dans <span className="font-mono">leases.auto_send_*</span>. Heure par défaut : 09:00.
                        </p>
                      </div>
                    </div>

                    <div className={"grid gap-3 sm:grid-cols-3 " + (!autoEnabled ? "opacity-50 pointer-events-none" : "")}>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Fréquence</label>
                        <select
                          value={autoFreq}
                          onChange={(e) => setAutoFreq(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="monthly">Mensuel</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Jour du mois (1–31)</label>
                        <input
                          value={autoDay}
                          onChange={(e) => setAutoDay(e.target.value)}
                          type="number"
                          min={1}
                          max={31}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Heure (0–23)</label>
                        <input
                          value={autoHour}
                          onChange={(e) => setAutoHour(e.target.value)}
                          type="number"
                          min={0}
                          max={23}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                    >
                      {editingLeaseId ? "Enregistrer les modifications" : "Créer ce bail"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>
              </form>

              {/* Generate receipt */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Générer / enregistrer une quittance
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Mois</label>
                    <input
                      type="month"
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Lieu d’émission</label>
                    <input
                      value={issuePlace}
                      onChange={(e) => setIssuePlace(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Ex: Paris"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Date d’émission</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                  <span>Inclure la mention “solde de tout compte”</span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveReceipt}
                  disabled={!currentLease && !editingLeaseId}
                  className={
                    "inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold " +
                    (currentLease || editingLeaseId
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-300 text-slate-600 cursor-not-allowed")
                  }
                >
                  Enregistrer la quittance (et l’ajouter à la liste)
                </button>

                {!hasLeases && (
                  <p className="text-[0.75rem] text-slate-600">
                    Astuce : créez d’abord un bail ci-dessus, puis vous pourrez enregistrer des quittances.
                  </p>
                )}
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Aperçu quittance
                  </p>
                  {currentReceipt && (
                    <span className="text-[0.7rem] text-slate-400">
                      (quittance enregistrée sélectionnée)
                    </span>
                  )}
                </div>

                <pre className="whitespace-pre-wrap text-[0.75rem] text-slate-800 leading-relaxed rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-[380px] overflow-auto">
                  {receiptPreview}
                </pre>
              </div>
            </section>
          </div>

          <div className="text-right">
            <a
              href="/outils-proprietaire"
              className="text-[0.75rem] text-slate-500 underline underline-offset-2"
            >
              ← Retour à la boîte à outils propriétaire
            </a>
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
