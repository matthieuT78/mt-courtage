import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getOrCreateTenantThread, getTenantPortalAccess } from "../../../lib/tenantPortal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const accesses = await getTenantPortalAccess(auth.userId);
    if (accesses.length === 0) {
      return res.status(403).json({ error: "Aucun espace locataire n’est rattaché à ce compte." });
    }
    const messagingEnabled = accesses.every((a) => a.messaging_enabled !== false)
      ? true
      : accesses.some((a) => a.messaging_enabled !== false);

    const tenantIds = accesses.map((access) => access.tenant_id);
    const landlordIds = Array.from(new Set(accesses.map((access) => access.landlord_user_id)));

    const [
      { data: tenants, error: tenantsError },
      { data: leases, error: leasesError },
      { data: landlords, error: landlordsError },
    ] = await Promise.all([
      supabaseAdmin.from("tenants").select("id,full_name,first_name,last_name,email,phone").in("id", tenantIds),
      supabaseAdmin.from("leases").select("*").in("tenant_id", tenantIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("landlords").select("user_id,display_name,address,iban,bic").in("user_id", landlordIds),
    ]);
    if (tenantsError) throw tenantsError;
    if (leasesError) throw leasesError;
    if (landlordsError) throw landlordsError;

    const leaseIds = (leases || []).map((lease: any) => lease.id);
    const propertyIds = Array.from(new Set((leases || []).map((lease: any) => lease.property_id).filter(Boolean)));
    const [
      { data: properties, error: propertiesError },
      { data: receipts, error: receiptsError },
      { data: reports, error: reportsError },
      { data: contracts, error: contractsError },
      { data: dpes, error: dpesError },
      { data: payments, error: paymentsError },
    ] = await Promise.all([
      propertyIds.length
        ? supabaseAdmin.from("properties").select("id,label,address_line1,address_line2,postal_code,city,country").in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
      leaseIds.length
        ? supabaseAdmin
            .from("rent_receipts")
            .select("id,lease_id,period_start,period_end,total_amount,issue_date,pdf_url,status,sent_at,receipt_number")
            .in("lease_id", leaseIds)
            .not("pdf_url", "is", null)
            .order("period_start", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      leaseIds.length
        ? supabaseAdmin
            .from("inventory_reports")
            .select("id,lease_id,report_type,status,performed_at,pdf_url")
            .in("lease_id", leaseIds)
            .not("pdf_url", "is", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      leaseIds.length
        ? supabaseAdmin
            .from("lease_contract_documents")
            .select("id,lease_id,contract_kind,status,document_source,signed_pdf_url,external_pdf_url,original_file_name,signed_at")
            .in("lease_id", leaseIds)
            .order("signed_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length
        ? supabaseAdmin
            .from("property_dpe_documents")
            .select("id,property_id,file_name,size_bytes,created_at")
            .in("property_id", propertyIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      leaseIds.length
        ? supabaseAdmin
            .from("rent_payments")
            .select("id,lease_id,period_start,period_end,paid_at,total_amount,rent_amount,charges_amount,source")
            .in("lease_id", leaseIds)
            .order("period_start", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (propertiesError) throw propertiesError;
    if (receiptsError) throw receiptsError;
    if (reportsError) throw reportsError;
    if (contractsError) throw contractsError;
    if (dpesError) throw dpesError;
    if (paymentsError) throw paymentsError;

    const threads = [];
    for (const access of accesses) {
      const lease = (leases || []).find((row: any) => row.tenant_id === access.tenant_id);
      threads.push(
        await getOrCreateTenantThread({
          landlordUserId: access.landlord_user_id,
          tenantId: access.tenant_id,
          leaseId: lease?.id || null,
          propertyId: lease?.property_id || null,
        })
      );
    }

    await supabaseAdmin
      .from("tenant_portal_access")
      .update({ status: "active", activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("tenant_user_id", auth.userId)
      .eq("status", "invited");

    // RGPD: only expose IBAN/BIC when the tenant's active lease uses virement
    const virementsLandlordIds = new Set(
      (leases || [])
        .filter((l: any) => l.payment_method === "virement" && l.status === "active")
        .map((l: any) => l.user_id)
    );
    const landlordsFiltered = (landlords || []).map((l: any) => ({
      user_id: l.user_id,
      display_name: l.display_name,
      address: l.address,
      ...(virementsLandlordIds.has(l.user_id) && l.iban ? { iban: l.iban, bic: l.bic || null } : {}),
    }));

    return res.status(200).json({
      user: { id: auth.userId, email: auth.email || null },
      messagingEnabled,
      tenants: tenants || [],
      leases: leases || [],
      landlords: landlordsFiltered,
      properties: properties || [],
      receipts: receipts || [],
      inventoryReports: reports || [],
      leaseContracts: (contracts || []).filter((contract: any) => contract.signed_pdf_url || contract.external_pdf_url),
      dpes: dpes || [],
      payments: payments || [],
      threads,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Chargement impossible." });
  }
}
