const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_USER_ID = process.env.TEST_USER_ID;     // ex: 9642...
const TEST_LEASE_ID = process.env.TEST_LEASE_ID;   // id d’un bail existant

if (!TEST_USER_ID || !TEST_LEASE_ID) {
  console.error("❌ Mets TEST_USER_ID et TEST_LEASE_ID");
  process.exit(1);
}

function monthRange(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const start = `${y}-${m}-01`;
  const end = new Date(y, d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

const { start, end } = monthRange();

const body = {
  userId: TEST_USER_ID,
  leaseId: TEST_LEASE_ID,
  periodStart: start,
  periodEnd: end,
  contentText: "TEST quittance SANS email",
  skipEmail: true,
};

const r = await fetch(`${BASE_URL}/api/receipts/send`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const txt = await r.text();
console.log("HTTP:", r.status);
console.log(txt);

if (!r.ok) process.exit(1);
console.log("✅ OK");
