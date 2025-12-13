// pages/quittances-loyer.tsx
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type LeaseRow = {
  id: string;
  start_date: string;
  rent_amount: number;
  charges_amount: number;
  payment_day: number;
  payment_method: string;
  auto_quittance_enabled: boolean;
  tenant_receipt_email: string | null;
  property: any;
  tenant: any;
};

export default function QuittancesLoyerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [selected, setSelected] = useState<LeaseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ---------- FORM STATE ---------- */
  const [form, setForm] = useState({
    propertyLabel: "",
    address1: "",
    postalCode: "",
    city: "",
    country: "France",

    tenantName: "",
    tenantEmail: "",
    tenantPhone: "",

    startDate: "",
    rent: "",
    charges: "",
    paymentDay: "1",
    paymentMethod: "virement",
    autoQuittance: true,
  });

  /* ---------- SESSION ---------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/mon-compte?mode=login&redirect=/quittances-loyer");
        return;
      }
      setUser(data.session.user);
    });
  }, []);

  /* ---------- LOAD LEASES ---------- */
  useEffect(() => {
    if (!user) return;

    supabase
      .from("leases")
      .select(`
        *,
        property:properties(*),
        tenant:tenants(*)
      `)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeases((data || []) as any);
        setLoading(false);
      });
  }, [user]);

  /* ---------- SELECT LEASE ---------- */
  const selectLease = (l: LeaseRow) => {
    setSelected(l);
    setForm({
      propertyLabel: l.property.label || "",
      address1: l.property.address_line1 || "",
      postalCode: l.property.postal_code || "",
      city: l.property.city || "",
      country: l.property.country || "France",

      tenantName: l.tenant.full_name || "",
      tenantEmail: l.tenant.email || "",
      tenantPhone: l.tenant.phone || "",

      startDate: l.start_date,
      rent: String(l.rent_amount),
      charges: String(l.charges_amount),
      paymentDay: String(l.payment_day),
      paymentMethod: l.payment_method,
      autoQuittance: l.auto_quittance_enabled,
    });
  };

  /* ---------- SAVE ---------- */
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      let propertyId = selected?.property?.id;
      let tenantId = selected?.tenant?.id;

      // PROPERTY
      if (!propertyId) {
        const { data } = await supabase
          .from("properties")
          .insert({
            user_id: user.id,
            label: form.propertyLabel,
            address_line1: form.address1,
            postal_code: form.postalCode,
            city: form.city,
            country: form.country,
          })
          .select()
          .single();
        propertyId = data.id;
      }

      // TENANT
      if (!tenantId) {
        const { data } = await supabase
          .from("tenants")
          .insert({
            user_id: user.id,
            full_name: form.tenantName,
            email: form.tenantEmail,
            phone: form.tenantPhone,
          })
          .select()
          .single();
        tenantId = data.id;
      }

      // LEASE
      if (selected) {
        await supabase.from("leases").update({
          start_date: form.startDate,
          rent_amount: Number(form.rent),
          charges_amount: Number(form.charges),
          payment_day: Number(form.paymentDay),
          payment_method: form.paymentMethod,
          auto_quittance_enabled: form.autoQuittance,
          tenant_receipt_email: form.tenantEmail,
        }).eq("id", selected.id);
      } else {
        await supabase.from("leases").insert({
          user_id: user.id,
          property_id: propertyId,
          tenant_id: tenantId,
          start_date: form.startDate,
          rent_amount: Number(form.rent),
          charges_amount: Number(form.charges),
          payment_day: Number(form.paymentDay),
          payment_method: form.paymentMethod,
          auto_quittance_enabled: form.autoQuittance,
          tenant_receipt_email: form.tenantEmail,
          status: "active",
        });
      }

      setMessage("Bien loué enregistré ✅");
      setSelected(null);
      setForm({
        propertyLabel: "",
        address1: "",
        postalCode: "",
        city: "",
        country: "France",
        tenantName: "",
        tenantEmail: "",
        tenantPhone: "",
        startDate: "",
        rent: "",
        charges: "",
        paymentDay: "1",
        paymentMethod: "virement",
        autoQuittance: true,
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ---------- */
  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[280px,1fr]">
        {/* LIST */}
        <aside className="bg-white rounded-2xl p-4 border">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            Mes biens loués
          </p>

          {leases.map((l) => (
            <button
              key={l.id}
              onClick={() => selectLease(l)}
              className="w-full text-left rounded-lg border px-3 py-2 mb-2 bg-slate-50 hover:bg-slate-100"
            >
              <p className="font-semibold text-sm">{l.property.label}</p>
              <p className="text-xs text-slate-500">
                {l.tenant.full_name} • {l.rent_amount} €
              </p>
            </button>
          ))}

          <button
            onClick={() => setSelected(null)}
            className="mt-3 w-full rounded-full bg-amber-500 text-xs font-semibold px-3 py-2"
          >
            + Nouveau bien loué
          </button>
        </aside>

        {/* FORM */}
        <section className="bg-white rounded-2xl p-5 border">
          <h1 className="text-lg font-semibold mb-4">
            {selected ? "Modifier le bien loué" : "Déclarer un bien loué"}
          </h1>

          {message && (
            <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 text-sm">
            <input placeholder="Nom du bien" value={form.propertyLabel}
              onChange={(e) => setForm({ ...form, propertyLabel: e.target.value })} className="w-full border rounded-lg px-3 py-2" />

            <input placeholder="Adresse" value={form.address1}
              onChange={(e) => setForm({ ...form, address1: e.target.value })} className="w-full border rounded-lg px-3 py-2" />

            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Code postal" value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input placeholder="Ville" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} className="border rounded-lg px-3 py-2" />
            </div>

            <input placeholder="Nom du locataire" value={form.tenantName}
              onChange={(e) => setForm({ ...form, tenantName: e.target.value })} className="w-full border rounded-lg px-3 py-2" />

            <input placeholder="Email du locataire" value={form.tenantEmail}
              onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} className="w-full border rounded-lg px-3 py-2" />

            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Loyer" value={form.rent}
                onChange={(e) => setForm({ ...form, rent: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input placeholder="Charges" value={form.charges}
                onChange={(e) => setForm({ ...form, charges: e.target.value })} className="border rounded-lg px-3 py-2" />
              <input placeholder="Jour paiement" value={form.paymentDay}
                onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} className="border rounded-lg px-3 py-2" />
            </div>

            <button disabled={saving} className="rounded-full bg-slate-900 text-white px-5 py-2 text-xs font-semibold">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
