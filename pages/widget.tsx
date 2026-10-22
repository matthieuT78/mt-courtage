// pages/widget.tsx
//
// Page vitrine B2B : simulateurs lokt.fr intégrables sur le site d'une
// agence immobilière. MVP volontairement minimal (cf. décision du
// 2026-10-22) : 3 simulateurs prêts à l'emploi, iframes fixes, pas de
// configurateur ni de compte partenaire — on valide la demande avant de
// construire plus.
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
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

type WidgetSize = "small" | "medium" | "large";
type ColorMode = "brand" | "neutral" | "custom";

type WidgetOption = {
  id: string;
  embedPath: string;
  label: string;
  title: string;
  pitch: string;
  sizes?: boolean;
  theming?: boolean;
};

const WIDGET_OPTIONS: WidgetOption[] = [
  {
    id: "capacite",
    embedPath: "/embed/capacite",
    label: "Capacité d'emprunt",
    title: "Simulateur de capacité d'emprunt",
    pitch: "La question que se pose tout acquéreur avant de contacter une agence : « est-ce que je peux me l'offrir ? ».",
    sizes: true,
    theming: true,
  },
  {
    id: "pret-relais",
    embedPath: "/embed/pret-relais",
    label: "Prêt relais",
    title: "Simulateur de prêt relais",
    pitch: "Utile pour vos clients vendeurs qui veulent acheter avant d'avoir vendu leur bien actuel.",
  },
  {
    id: "investissement",
    embedPath: "/embed/investissement",
    label: "Rentabilité locative",
    title: "Simulateur de rentabilité locative",
    pitch: "Pour les agences qui traitent aussi de l'investissement locatif : cash-flow, rendement brut et net.",
  },
];

// Même contenu (même wizard, mêmes questions, même analyse) pour les 3
// tailles — seule la largeur change. En dessous de 640px, le simulateur
// bascule déjà naturellement sur sa mise en page mobile (une colonne) :
// contraindre la largeur d'intégration suffit à obtenir un format compact,
// sans retirer la moindre information.
const SIZE_META: Record<WidgetSize, { label: string; desc: string; maxWidth: number | null }> = {
  small: { label: "Petit", desc: "~360px de large — pour une sidebar ou un encart étroit.", maxWidth: 360 },
  medium: { label: "Moyen", desc: "~520px de large — pour une colonne ou une section dédiée.", maxWidth: 520 },
  large: { label: "Grand", desc: "Pleine largeur — pour une page financement à part entière.", maxWidth: null },
};

function colorQueryParam(opt: WidgetOption, colorMode: ColorMode, customAccent: string) {
  if (!opt.theming) return "";
  if (colorMode === "neutral") return "theme=neutral";
  if (colorMode === "custom" && /^[0-9a-fA-F]{6}$/.test(customAccent)) return `accent=${customAccent}`;
  return "";
}

function iframeSnippetFor(opt: WidgetOption, size: WidgetSize, colorMode: ColorMode, customAccent: string) {
  const maxWidth = opt.sizes ? SIZE_META[size].maxWidth : null;
  const wrapOpen = maxWidth ? `<div style="max-width:${maxWidth}px;margin:0 auto;">\n` : "";
  const wrapClose = maxWidth ? `\n</div>` : "";
  const colorParam = colorQueryParam(opt, colorMode, customAccent);
  const src = colorParam ? `https://lokt.fr${opt.embedPath}?${colorParam}` : `https://lokt.fr${opt.embedPath}`;
  return `${wrapOpen}<iframe
  data-lokt-widget
  src="${src}"
  width="100%"
  height="700"
  style="border:0;border-radius:16px;"
  loading="lazy"
  title="${opt.title} - lokt.fr">
</iframe>
<p style="margin-top:8px;font-size:12px;color:#64748b;text-align:center;">
  Simulateur propulsé par <a href="https://lokt.fr" target="_blank" rel="noopener">lokt.fr</a>
</p>${wrapClose}
<script>
  // Ajuste automatiquement la hauteur de l'iframe au contenu réel
  // (le simulateur grandit quand le résultat s'affiche) — à garder une
  // seule fois sur la page même si vous intégrez plusieurs simulateurs.
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://lokt.fr") return;
    if (!e.data || e.data.source !== "lokt-widget") return;
    document.querySelectorAll("iframe[data-lokt-widget]").forEach(function (frame) {
      if (frame.contentWindow === e.source) frame.style.height = e.data.height + "px";
    });
  });
</script>`;
}

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
  const title = "Simulateurs immobiliers à intégrer sur votre site d'agence | lokt.fr";
  const description =
    "Intégrez gratuitement un simulateur lokt.fr (capacité d'emprunt, prêt relais, rentabilité locative) sur votre site d'agence immobilière. Une iframe à copier-coller, aucune compétence technique requise.";
  const [selectedId, setSelectedId] = useState(WIDGET_OPTIONS[0].id);
  const selected = WIDGET_OPTIONS.find((o) => o.id === selectedId) ?? WIDGET_OPTIONS[0];
  const [selectedSize, setSelectedSize] = useState<WidgetSize>("large");
  const [colorMode, setColorMode] = useState<ColorMode>("brand");
  const [customAccent, setCustomAccent] = useState("2563eb");
  const demoFrameRef = useRef<HTMLIFrameElement>(null);
  const [demoHeight, setDemoHeight] = useState(700);
  const demoMaxWidth = selected.sizes ? SIZE_META[selectedSize].maxWidth : null;
  const demoColorParam = colorQueryParam(selected, colorMode, customAccent);
  const demoSrc = demoColorParam ? `${selected.embedPath}?${demoColorParam}` : selected.embedPath;

  // La démo ci-dessous est une iframe comme celle que l'agence intègre :
  // même mécanisme d'auto-redimensionnement que le script fourni dans le
  // code à copier, pour que la démo ne souffre pas du même souci que celui
  // signalé (hauteur fixe qui coupe le contenu une fois le résultat affiché).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://lokt.fr" && e.origin !== window.location.origin) return;
      if (!e.data || e.data.source !== "lokt-widget") return;
      if (demoFrameRef.current && demoFrameRef.current.contentWindow === e.source) {
        setDemoHeight(e.data.height);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    setDemoHeight(700);
    if (!selected.sizes) setSelectedSize("large");
    if (!selected.theming) setColorMode("brand");
  }, [selectedId, selected.sizes, selected.theming]);

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
              Offrez à vos visiteurs un simulateur immobilier — sur votre site, en 2 minutes.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              Capacité d'emprunt, prêt relais, rentabilité locative : choisissez le simulateur le plus pertinent pour vos
              clients et intégrez-le à votre site en copiant un seul bloc de code — aucune compétence technique requise.
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

        {/* Choix du simulateur + démo + intégration */}
        <section id="demo" className="border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Choisissez votre simulateur</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                3 simulateurs, un seul à intégrer (ou les trois)
              </h2>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {WIDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={
                    "rounded-full border px-4 py-2 text-sm font-semibold transition " +
                    (opt.id === selectedId
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-slate-600">{selected.pitch}</p>

            {selected.sizes && (
              <div className="mt-8">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Choisissez une taille</p>
                <div className="mt-4 flex flex-wrap items-end justify-center gap-4">
                  {(["small", "medium", "large"] as WidgetSize[]).map((size) => {
                    // La hauteur de l'aperçu augmente quand la largeur diminue — reflète
                    // ce qui se passe réellement (même contenu, qui se replie davantage
                    // à la verticale dans un conteneur plus étroit).
                    const previewWidth = size === "small" ? 64 : size === "medium" ? 104 : 168;
                    const previewHeight = size === "small" ? 140 : size === "medium" ? 112 : 96;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className="flex flex-col items-center gap-2"
                      >
                        <span
                          style={{ width: previewWidth, height: previewHeight }}
                          className={
                            "flex items-center justify-center rounded-2xl border-2 bg-white text-xs font-semibold shadow-sm transition " +
                            (selectedSize === size ? "border-slate-950 text-slate-950" : "border-slate-200 text-slate-400 hover:border-slate-300")
                          }
                        >
                          {SIZE_META[size].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mx-auto mt-3 max-w-sm text-center text-xs leading-5 text-slate-500">{SIZE_META[selectedSize].desc}</p>
              </div>
            )}

            {selected.theming && (
              <div className="mt-8">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Couleur</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {(
                    [
                      ["brand", "Couleurs lokt.fr"],
                      ["neutral", "Neutre (gris)"],
                      ["custom", "Ma couleur"],
                    ] as [ColorMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setColorMode(mode)}
                      className={
                        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition " +
                        (colorMode === mode
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")
                      }
                    >
                      {label}
                    </button>
                  ))}
                  {colorMode === "custom" && (
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                      <input
                        type="color"
                        value={/^[0-9a-fA-F]{6}$/.test(customAccent) ? `#${customAccent}` : "#2563eb"}
                        onChange={(e) => setCustomAccent(e.target.value.replace("#", ""))}
                        className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="text-xs font-mono text-slate-500">#{customAccent}</span>
                    </label>
                  )}
                </div>
                <p className="mx-auto mt-3 max-w-sm text-center text-xs leading-5 text-slate-500">
                  Sur un site au style sobre, « Neutre » ou une couleur d'accent personnalisée s'intègrent souvent mieux que nos couleurs de
                  marque.
                </p>
              </div>
            )}

            <div
              className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 shadow-xl shadow-slate-900/5 transition-all"
              style={{ maxWidth: demoMaxWidth ?? undefined, marginLeft: "auto", marginRight: "auto" }}
            >
              <iframe
                key={selected.id}
                ref={demoFrameRef}
                src={demoSrc}
                width="100%"
                height={demoHeight}
                style={{ border: 0, display: "block", transition: "height 150ms ease" }}
                loading="lazy"
                title={`Démo — ${selected.title} lokt.fr`}
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
                Un seul bloc de code à copier — {selected.label}
                {selected.sizes ? ` (${SIZE_META[selectedSize].label.toLowerCase()})` : ""}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Collez ce code à l'endroit de votre page où le simulateur doit apparaître (CMS, page HTML, section dédiée au
                financement). Il s'adapte automatiquement à la largeur disponible.
              </p>
            </div>
            <div className="mt-8">
              <CodeBlock code={iframeSnippetFor(selected, selectedSize, colorMode, customAccent)} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Fonctionne sur tout site qui accepte du HTML — WordPress, Wix, site sur mesure, etc.",
                "La mention « Propulsé par lokt.fr » reste visible sous le simulateur.",
                "Aucune donnée de vos visiteurs ne vous est transmise automatiquement dans cette version.",
                "Vous pouvez intégrer plusieurs simulateurs sur des pages différentes de votre site.",
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
                  q: "Puis-je intégrer plusieurs simulateurs ?",
                  a: "Oui, les 3 simulateurs ci-dessus sont chacun disponibles en intégration indépendante — vous pouvez n'en mettre qu'un, ou les trois sur des pages différentes de votre site. Besoin d'un autre simulateur de notre catalogue ? Écrivez-nous à contact@lokt.fr.",
                },
                {
                  q: "La taille « petite » retire-t-elle des questions au simulateur ?",
                  a: "Non. C'est le même simulateur, les mêmes questions et la même analyse quelle que soit la taille choisie — seule la largeur d'intégration change, pour s'adapter à une sidebar, une colonne ou une page entière. En dessous de 640px de large, l'affichage bascule simplement sur une présentation verticale, comme sur mobile.",
                },
                {
                  q: "Les 3 tailles sont-elles disponibles pour tous les simulateurs ?",
                  a: "Pour l'instant, le choix de taille (petit / moyen / grand) n'est disponible que pour la capacité d'emprunt. Les autres simulateurs s'intègrent en pleine largeur — on l'étendra si cette fonctionnalité est utile aux agences qui l'utilisent.",
                },
                {
                  q: "Puis-je changer les couleurs du simulateur ?",
                  a: "Oui, pour la capacité d'emprunt : « Neutre » applique une palette grise discrète, ou vous choisissez votre propre couleur d'accent. Le code généré ci-dessus intègre automatiquement votre choix — rien à faire d'autre.",
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
