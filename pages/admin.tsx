import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/leads");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <p className="text-sm text-slate-600">Redirection vers le cockpit admin…</p>
    </main>
  );
}
