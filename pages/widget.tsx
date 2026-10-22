// pages/widget.tsx
//
// Page vitrine B2B : simulateurs lokt.fr intégrables sur le site d'une
// agence immobilière. MVP volontairement minimal (cf. décision du
// 2026-10-22) : un seul simulateur (capacité d'emprunt), une iframe fixe,
// pas de configurateur ni de compte partenaire — on valide la demande
// avant de construire plus.
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  BoltIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

const IFRAME_SNIPPET = `<iframe
  src="https://lokt.fr/embed/capacite"
  width="100%"
  height="900"
  style="border:0;border-radius:16px;"
  loading="lazy"
  title="Simulateur de capacité d'emprunt - lokt.fr">
</iframe>
<p style="margin-top:8px;font-size:12px;color:#64748b;text-align:center;">
  Simulateur propulsé par <a href="https://lokt.fr" target="_blank" rel="noopener">lokt.fr</a>
</p>`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-white/60">
          <CodeBracketIcon className="h-4 w-4" />
          HTML à coller sur votre site
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
        >
          {copied ? <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[0.78rem] leading-6 text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function WidgetPage() {
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/widget`;
  const title = "Widget simulateur de capacité d'emprunt pour agences immobilières | lokt.fr";
  const description =
    "Intégrez gratuitement le simulateur de capacité d'emprunt lokt.fr sur votre site d'agence immobilière. Une iframe à copier-coller, aucune compétence technique requise.";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
      </Head>

      <AppHeader staticMode />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-[0.72rem] font-semibold text-[#4f46e5]">
              <BoltIcon className="h-3.5 w-3.5" />
              Gratuit pour les agences immobilières
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Offrez à vos visiteurs un simulateur de capacité d'emprunt — sur votre site, en 2 minutes.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              Un acquéreur qui visite une annonce se demande d'abord « est-ce que je peux me l'offrir ? ». lokt.fr vous propose
              un simulateur prêt à l'emploi, propulsé par notre moteur de calcul, à intégrer sur votre site en copiant un seul
              bloc de code — aucune compétence technique requise.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#integration" className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-7 text-sm font-semibold text-white hover:bg-slate-800">
                Voir le code d'intégration
              </a>
              <a href="#demo" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Essayer le simulateur
              </a>
            </div>
          </div>
        </section>

        {/* Valeur */}
        <section className="border-b border-slate-200 bg-[#f6f9fc] px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  icon: UserGroupIcon,
                  title: "Des prospects plus qualifiés",
                  text: "Un visiteur qui connaît déjà son budget avant de vous contacter est un prospect plus avancé dans sa réflexion d'achat.",
                },
                {
                  icon: BoltIcon,
                  title: "Zéro développement",
                  text: "Un seul bloc de code HTML à coller sur votre site. Pas de plugin, pas de compte technique, pas de maintenance de votre côté.",
                },
                {
                  icon: ShieldCheckIcon,
                  title: "Toujours à jour",
                  text: "Le calcul est hébergé et maintenu par lokt.fr : les évolutions et corrections s'appliquent automatiquement, sans rien faire.",
                },
              ].map(({ icon: Icon, title: t, text }) => (
                <div key={t} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#635bff]/10">
                    <Icon className="h-5 w-5 text-[#635bff]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">{t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Démo */}
        <section id="demo" className="border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Aperçu</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Exactement ce que verront vos visiteurs
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Le même simulateur qui s'affichera dans votre iframe, sans aucune mise en forme supplémentaire de notre part.
              </p>
            </div>
            <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 shadow-xl shadow-slate-900/5">
              <iframe
                src="/embed/capacite"
                width="100%"
                height={900}
                style={{ border: 0, display: "block" }}
                loading="lazy"
                title="Démo — simulateur de capacité d'emprunt lokt.fr"
              />
            </div>
          </div>
        </section>

        {/* Intégration */}
        <section id="integration" className="border-b border-slate-200 bg-[#f6f9fc] px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Intégration</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Un seul bloc de code à copier
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Collez ce code à l'endroit de votre page où le simulateur doit apparaître (CMS, page HTML, section dédiée au
                financement). Il s'adapte automatiquement à la largeur disponible.
              </p>
            </div>
            <div className="mt-8">
              <CodeBlock code={IFRAME_SNIPPET} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Fonctionne sur tout site qui accepte du HTML — WordPress, Wix, site sur mesure, etc.",
                "La mention « Propulsé par lokt.fr » reste visible sous le simulateur.",
                "Aucune donnée de vos visiteurs ne vous est transmise automatiquement dans cette version.",
                "Besoin d'une intégration spécifique (couleurs, autre simulateur) ? Écrivez-nous.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ / légal */}
        <section className="bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Questions fréquentes</h2>
            <div className="mt-6 space-y-3">
              {[
                {
                  q: "C'est vraiment gratuit ?",
                  a: "Oui, cette version du simulateur est gratuite et sans engagement. Elle est encore en phase de test : nous l'enrichirons selon les retours des agences qui l'utilisent.",
                },
                {
                  q: "Le résultat du simulateur engage-t-il lokt.fr ou l'agence ?",
                  a: "Non. Le résultat est une estimation indicative basée sur les informations saisies par le visiteur. Il ne constitue ni une offre de prêt, ni un accord de financement, ni un conseil personnalisé.",
                },
                {
                  q: "Puis-je intégrer un autre simulateur (rentabilité, prêt relais) ?",
                  a: "Pas encore en libre-service — écrivez-nous à contact@lokt.fr en précisant le simulateur souhaité, nous étudions les demandes au cas par cas pendant cette phase de test.",
                },
                {
                  q: "Puis-je retirer la mention « Propulsé par lokt.fr » ?",
                  a: "Pas sur cette offre gratuite — c'est elle qui nous permet de proposer le simulateur sans facturation.",
                },
              ].map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                    {q}
                    <span className="text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-950 px-6 py-7 text-center text-white">
              <h3 className="text-lg font-semibold">Une question, une demande spécifique ?</h3>
              <p className="mt-2 text-sm text-slate-300">
                Écrivez-nous, nous répondons directement.
              </p>
              <a
                href="mailto:contact@lokt.fr?subject=Widget%20simulateur%20-%20agence%20immobili%C3%A8re"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                contact@lokt.fr
              </a>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
