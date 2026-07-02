import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";
import { signOutAll } from "../../lib/authUtils";
import { useAuthUser } from "../../hooks/useAuthUser";
import { PAID_BILLING_PLANS } from "../../lib/billingPlans";
import { usePermissions } from "../../components/PermissionProvider";

type Billing = "monthly" | "yearly";

type BillingInvoice = {
  id: string;
  stripe_invoice_id: string;
  invoice_number: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency: string | null;
  status: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  period_start: string | null;
  period_end: string | null;
  stripe_created_at: string | null;
  created_at: string | null;
};

function ReferralSection({ userId }: { userId: string }) {
  const referralCode = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}?ref=${referralCode}`
      : `https://lokt.fr?ref=${referralCode}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="rounded-3xl border border-[#635bff]/20 bg-gradient-to-br from-[#f6f9fc] to-white shadow-sm px-6 py-6 sm:px-8">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#635bff]/10 text-[#635bff]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Parrainez un bailleur — 3 mois à −50 % pour vous deux</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Invitez un propriétaire à rejoindre lokt.fr avec votre lien. Dès qu'il souscrit,{" "}
            <strong className="font-semibold text-slate-900">vous bénéficiez tous les deux de 3 mois à moitié prix</strong>{" "}
            — appliqués automatiquement sur vos abonnements respectifs.
          </p>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Votre lien de parrainage</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="truncate font-mono text-xs text-slate-700">{referralLink}</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={
                  "shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold transition " +
                  (copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50")
                }
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Code personnel :{" "}
            <span className="font-mono font-semibold text-slate-700">{referralCode}</span>
            {" "}· Votre filleul peut aussi le mentionner à{" "}
            <a href="mailto:contact@lokt.fr?subject=Parrainage%20lokt.fr" className="underline hover:text-slate-700">
              contact@lokt.fr
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  children,
  tone = "slate",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  tone?: "emerald" | "slate";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`flex h-full flex-col rounded-2xl border p-4 ${cls}`}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      <div className="mt-3 flex flex-1 flex-col text-sm text-slate-700">{children}</div>
    </div>
  );
}

function formatInvoiceAmount(amount: number | null | undefined, currency: string | null | undefined) {
  const value = Number(amount || 0) / 100;
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatInvoiceStatus(status: string | null | undefined) {
  if (status === "paid") return "Payée";
  if (status === "open") return "À régler";
  if (status === "draft") return "Brouillon";
  if (status === "void") return "Annulée";
  if (status === "uncollectible") return "Irrécouvrable";
  return status || "-";
}

export default function MonCompteAbonnementPage() {
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();
  const { loading: permissionsLoading, plan, maxActiveProperties } = usePermissions();
  const [propertyCount, setPropertyCount] = useState<number | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [autoCheckoutStarted, setAutoCheckoutStarted] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const handleLogout = async () => { await signOutAll(); };

  useEffect(() => {
    const load = async () => {
      if (!supabase || !user?.id) return;
      const { data } = await supabase
        .from("properties")
        .select("id,status")
        .eq("user_id", user.id);
      const activeCount = (data ?? []).filter((property: any) => (property?.status || "").toLowerCase() !== "archived").length;
      setPropertyCount(activeCount);
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!supabase || !user?.id) return;
      setInvoicesLoading(true);
      setInvoicesError(null);
      try {
        const { data, error } = await supabase
          .from("billing_invoices")
          .select(
            "id,stripe_invoice_id,invoice_number,amount_due,amount_paid,currency,status,hosted_invoice_url,invoice_pdf_url,period_start,period_end,stripe_created_at,created_at"
          )
          .eq("user_id", user.id)
          .order("stripe_created_at", { ascending: false, nullsFirst: false })
          .limit(24);
        if (error) throw error;
        setInvoices((data as BillingInvoice[]) || []);
      } catch (error: any) {
        setInvoicesError(error?.message || "Impossible de charger les factures.");
        setInvoices([]);
      } finally {
        setInvoicesLoading(false);
      }
    };
    loadInvoices();
  }, [user?.id]);

  const startCheckout = async (plan: string) => {
    setCheckoutError(null);
    setCheckoutLoading(plan);

    try {
      if (!supabase) throw new Error("Authentification indisponible.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Merci de vous connecter avant de souscrire.");

      const resp = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billing }),
      });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || "Impossible de démarrer le paiement.");
      if (!payload?.url) throw new Error("URL de paiement Stripe manquante.");

      window.location.href = payload.url;
    } catch (error: any) {
      setCheckoutError(error?.message || "Impossible de démarrer le paiement.");
      setCheckoutLoading(null);
    }
  };

  useEffect(() => {
    if (!router.isReady || checking || !isLoggedIn || autoCheckoutStarted) return;
    const requestedPlan = typeof router.query.plan === "string" ? router.query.plan : "";
    const requestedBilling = router.query.billing === "yearly" ? "yearly" : router.query.billing === "monthly" ? "monthly" : billing;
    const planExists = PAID_BILLING_PLANS.some((item) => item.id === requestedPlan && item.monthlyPrice != null);
    if (!requestedPlan || !planExists) return;
    if (requestedBilling !== billing) {
      setBilling(requestedBilling);
      return;
    }
    setAutoCheckoutStarted(true);
    startCheckout(requestedPlan);
  }, [autoCheckoutStarted, billing, checking, isLoggedIn, router.isReady, router.query.billing, router.query.plan]);

  const openCustomerPortal = async () => {
    setCheckoutError(null);
    setPortalLoading(true);

    try {
      if (!supabase) throw new Error("Authentification indisponible.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Merci de vous reconnecter.");

      const resp = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || "Impossible d’ouvrir le portail Stripe.");
      if (!payload?.url) throw new Error("URL du portail Stripe manquante.");

      window.location.href = payload.url;
    } catch (error: any) {
      setCheckoutError(error?.message || "Impossible d’ouvrir le portail Stripe.");
      setPortalLoading(false);
    }
  };

  const planLabel =
    plan === "landlord_5"
      ? "lokt·one"
      : plan === "landlord_15"
      ? "lokt·plus"
      : plan === "landlord_unlimited"
      ? "Pro / agence"
      : plan === "calc_full"
      ? "Gratuit"
      : "Non connecté";

  const includedProperties =
    maxActiveProperties >= 999999 ? "Illimité" : `${Math.max(maxActiveProperties, 0)} logement${maxActiveProperties > 1 ? "s" : ""}`;
  const isFreePlan = plan === "calc_full";

  if (checking) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Chargement…</div>;

  return (
    <AccountLayout userEmail={user?.email ?? null} active="abonnement" onLogout={handleLogout}>
      {!isLoggedIn ? (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-slate-900">Accès requis</h2>
          <p className="text-sm text-slate-600 mt-1">Merci de te connecter pour consulter ton abonnement.</p>
          <Link className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white" href="/mon-compte">
            Aller à la connexion
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-6 py-6 sm:px-8">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Abonnement</p>
            <h2 className="text-lg font-semibold text-slate-900">Votre offre</h2>
            <p className="mt-1 text-sm text-slate-600">
              Le premier logement actif reste gratuit. Les abonnements débloquent surtout l’automatisation, le pilotage et l’aide à la déclaration.
            </p>

            {router.query.checkout === "success" ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Paiement validé. Votre abonnement va être activé automatiquement après confirmation Stripe.
              </div>
            ) : null}

            {router.query.checkout === "cancel" ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Paiement annulé. Vous pouvez relancer la souscription quand vous voulez.
              </div>
            ) : null}

            {checkoutError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{checkoutError}</div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Plan actuel</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{permissionsLoading ? "…" : planLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Logements inclus</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{permissionsLoading ? "…" : includedProperties}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Logements actifs</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{propertyCount === null ? "…" : propertyCount}</p>
              </div>
            </div>

            {isFreePlan && propertyCount !== null && propertyCount >= 1 ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                L’offre gratuite couvre votre premier logement actif. Dès que vous souhaitez ajouter un 2e logement, l’espace bailleur vous demandera de souscrire à un abonnement.
              </div>
            ) : null}

            {!isFreePlan && !permissionsLoading ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Votre abonnement est actif. Vous pouvez gérer plusieurs logements et accéder aux fonctionnalités premium, dont l’aide à la déclaration.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/espace-bailleur" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Accéder à l’espace bailleur
              </Link>
              <a href="mailto:contact@lokt.fr" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Donner mon avis sur l’offre
              </a>
              {!isFreePlan ? (
                <button
                  type="button"
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  {portalLoading ? "Ouverture Stripe…" : "Paiement et annulation"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-6 py-5 sm:px-8">
            <p className="text-sm font-semibold text-slate-900">Choisir une facturation</p>
            <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["monthly", "yearly"] as Billing[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBilling(value)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    billing === value ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {value === "monthly" ? "Mensuel" : "Annuel"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Le paiement, les factures et l’annulation sont gérés par Stripe.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Mes factures</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Les factures payées via Stripe apparaissent ici après confirmation du webhook.
                </p>
              </div>
              {!isFreePlan ? (
                <button
                  type="button"
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  {portalLoading ? "Ouverture Stripe…" : "Paiement et annulation"}
                </button>
              ) : null}
            </div>

            {invoicesError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {invoicesError}
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="p-3 text-xs font-semibold text-slate-600">Date</th>
                    <th className="p-3 text-xs font-semibold text-slate-600">Facture</th>
                    <th className="p-3 text-xs font-semibold text-slate-600">Période</th>
                    <th className="p-3 text-xs font-semibold text-slate-600">Montant</th>
                    <th className="p-3 text-xs font-semibold text-slate-600">Statut</th>
                    <th className="p-3 text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-100">
                      <td className="p-3 text-slate-700">{formatDate(invoice.stripe_created_at || invoice.created_at)}</td>
                      <td className="p-3 font-semibold text-slate-900">{invoice.invoice_number || invoice.stripe_invoice_id}</td>
                      <td className="p-3 text-slate-700">
                        {formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}
                      </td>
                      <td className="p-3 text-slate-700">{formatInvoiceAmount(invoice.amount_paid || invoice.amount_due, invoice.currency)}</td>
                      <td className="p-3 text-slate-700">{formatInvoiceStatus(invoice.status)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {invoice.invoice_pdf_url ? (
                            <a
                              href={invoice.invoice_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              PDF
                            </a>
                          ) : null}
                          {invoice.hosted_invoice_url ? (
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                            >
                              Voir
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-sm text-slate-500">
                        {invoicesLoading ? "Chargement des factures…" : "Aucune facture disponible pour le moment."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {user?.id ? <ReferralSection userId={user.id} /> : null}

          <div className="grid gap-3 lg:grid-cols-4">
            <PlanCard title="Gratuit" subtitle="Pour gérer un premier logement" tone="emerald">
              <ul className="space-y-1 text-sm">
                <li>1 logement actif</li>
                <li>Quittances manuelles, baux, locataires</li>
                <li>États des lieux, inventaire et finance simple</li>
                <li className="text-slate-500">Aide déclaration premium non incluse</li>
              </ul>
            </PlanCard>

            {PAID_BILLING_PLANS.map((plan) => (
              <PlanCard key={plan.id} title={plan.name} subtitle={plan.description}>
                <div className="min-h-[3rem]">
                  <p className="text-sm font-semibold text-slate-900">
                    {billing === "yearly" && plan.yearlyPrice != null ? `${plan.yearlyPrice} € / an` : plan.priceLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {plan.monthlyPrice == null ? plan.limitLabel : billing === "yearly" ? "2 mois offerts" : plan.limitLabel}
                  </p>
                </div>
                {plan.monthlyPrice == null ? (
                  <a
                    href="mailto:contact@lokt.fr?subject=Offre%20Pro%20Agence%20lokt.fr"
                    className="mt-auto inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Nous contacter
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCheckout(plan.id)}
                    disabled={checkoutLoading !== null}
                    className="mt-auto w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {checkoutLoading === plan.id ? "Redirection Stripe…" : "Souscrire"}
                  </button>
                )}
              </PlanCard>
            ))}
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
