import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HomeIcon,
  KeyIcon,
  WrenchScrewdriverIcon,
  ArrowLeftStartOnRectangleIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { GUIDE_CATEGORIES, GUIDES, getGuidesByCategory, type GuideCategory } from "../../lib/guides";

const CATEGORY_ICONS: Record<GuideCategory, React.ElementType> = {
  preparer: HomeIcon,
  arrivee: KeyIcon,
  gestion: WrenchScrewdriverIcon,
  depart: ArrowLeftStartOnRectangleIcon,
  fiscal: ReceiptPercentIcon,
};

const CATEGORY_COLORS: Record<GuideCategory, { bg: string; text: string; border: string; num: string }> = {
  preparer:  { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200", num: "bg-indigo-700" },
  arrivee:   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", num: "bg-emerald-700" },
  gestion:   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  num: "bg-amber-600" },
  depart:    { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",   num: "bg-rose-600" },
  fiscal:    { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200", num: "bg-violet-700" },
};

export default function GuidesIndexPage() {
  const metaTitle = "Guide du bailleur : mettre en location et gérer un logement | lokt.fr";
  const description =
    "14 guides bailleur : du DPE au départ du locataire, plus un guide complet sur la déclaration fiscale des revenus locatifs (LMNP, nu, Pinel). Checklists incluses.";

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://lokt.fr/guides" />
      </Head>
      <AppHeader staticMode />

      {/* ── Hero ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
            <BookOpenIcon className="h-3.5 w-3.5" />
            Guide du bailleur
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            Louer proprement, sans perdre le fil.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            14 guides pratiques organisés dans l'ordre du bail — de la mise en location au départ du locataire, plus un guide complet sur la fiscalité. Chaque guide contient les points de contrôle, les règles clés et une checklist opérationnelle.
          </p>

          {/* Lifecycle pills */}
          <div className="mt-7 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {GUIDE_CATEGORIES.map((cat, i) => {
              const color = CATEGORY_COLORS[cat.key];
              return (
                <a key={cat.key} href={`#${cat.key}`} className={`flex items-center gap-2 rounded-full border ${color.border} ${color.bg} ${color.text} px-3 py-1.5 transition hover:opacity-80`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full ${color.num} text-[0.6rem] font-bold text-white`}>{i + 1}</span>
                  {cat.label}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contexte éditorial ── */}
      <section className="border-b border-slate-100 bg-white px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm leading-7 text-slate-500">
            En France, un bailleur particulier gère en moyenne 1 à 3 logements sans formation juridique ni comptable.
            Chaque guide lokt.fr couvre une étape précise du cycle locatif avec les règles essentielles, les erreurs fréquentes à éviter et une checklist opérationnelle.
            Du choix du locataire jusqu'à la restitution du dépôt de garantie, vous trouverez ici les réponses concrètes que ni un forum ni un modèle de document ne peut donner seul.
          </p>
        </div>
      </section>

      {/* ── Categories ── */}
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
        {GUIDE_CATEGORIES.map((category, index) => {
          const guides = getGuidesByCategory(category.key);
          const color = CATEGORY_COLORS[category.key];
          const Icon = CATEGORY_ICONS[category.key];

          return (
            <section key={category.key} id={category.key} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Category header */}
              <div className={`flex items-start gap-4 rounded-t-2xl border-b border-slate-200 ${color.bg} px-5 py-4 sm:px-6`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color.num} text-sm font-bold text-white shadow-sm`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className={`text-base font-semibold ${color.text} sm:text-lg`}>{category.label}</h2>
                      <p className="mt-0.5 text-sm leading-5 text-slate-600">{category.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border ${color.border} bg-white/70 px-2.5 py-0.5 text-xs font-semibold ${color.text}`}>
                      {guides.length} guide{guides.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guide cards */}
              <div className="grid gap-px bg-slate-200 rounded-b-2xl overflow-hidden sm:grid-cols-2">
                {guides.map((guide) => {
                  const hasChecklist = !!guide.checklist;
                  return (
                    <Link
                      key={guide.slug}
                      href={`/guides/${guide.slug}`}
                      className="group flex flex-col bg-white px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${color.bg} ${color.text}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className={`mt-1 text-xs font-semibold ${color.text} transition group-hover:translate-x-0.5`}>
                          Lire →
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-950 sm:text-[0.95rem]">{guide.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">{guide.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                          {guide.sections.length} étapes
                        </span>
                        {hasChecklist && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">
                            ✓ Checklist
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Bottom note */}
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <DocumentTextIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-xs leading-5 text-slate-500">
            Ces guides donnent des repères généraux. Pour une décision juridique ou fiscale engageante, vérifiez votre situation auprès d'une ADIL, d'un professionnel du droit ou d'un expert-comptable.
          </p>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
