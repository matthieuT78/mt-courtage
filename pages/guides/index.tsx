import Head from "next/head";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, CheckCircleIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { GUIDE_CATEGORIES, getGuidesByCategory } from "../../lib/guides";

export default function GuidesIndexPage() {
  const title = "Guide du bailleur : mettre en location et gérer un logement | lokt.fr";
  const description =
    "Guides pratiques pour préparer une location, accueillir un locataire, suivre le bail et organiser son départ : DPE, LMNP, charges, travaux et état des lieux.";

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://lokt.fr/guides" />
      </Head>
      <AppHeader staticMode />

      <main>
        <section className="border-b border-slate-200 bg-white px-4 py-8 sm:py-12">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr),360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
                <BookOpenIcon className="h-4 w-4" />
                Guide du bailleur
              </div>
              <h1 className="mt-5 max-w-3xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                Louer proprement, sans perdre le fil.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Des guides pratiques pour préparer une location, accueillir un locataire, suivre le bail et organiser le départ. Chaque guide vise une action concrète : décider, vérifier, documenter ou archiver.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
              <ClipboardDocumentCheckIcon className="h-7 w-7 text-indigo-700" />
              <p className="mt-3 text-sm font-semibold text-slate-950">Ressources métier</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les pages SEO détaillent un sujet précis. Les guides servent de parcours opérationnel pour gérer un bail de bout en bout.
              </p>
              <Link href="/outil-gestion-locative" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                Passer dans l’outil <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="grid gap-6">
            {GUIDE_CATEGORIES.map((category, index) => {
              const guides = getGuidesByCategory(category.key);
              return (
                <section key={category.key} id={category.key} className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                      {index + 1}
                      </span>
                      <div>
                        <h2 className="text-xl font-semibold text-slate-950">{category.label}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{category.description}</p>
                      </div>
                    </div>
                    <span className="w-max rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {guides.length} guide{guides.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {guides.map((guide) => (
                      <Link
                        key={guide.slug}
                        href={`/guides/${guide.slug}`}
                        className="group rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 ring-1 ring-slate-200">
                            <CheckCircleIcon className="h-5 w-5" />
                          </span>
                          <span className="text-sm font-semibold text-indigo-700 transition group-hover:translate-x-0.5">Lire →</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold leading-6 text-slate-950">{guide.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{guide.description}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-8 rounded-[1.25rem] border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
            Ces guides donnent des repères généraux. Pour une décision juridique ou fiscale engageante, vérifiez votre situation auprès d’une ADIL,
            d’un professionnel du droit ou d’un expert-comptable.
          </p>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
