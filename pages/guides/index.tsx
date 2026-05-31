import Head from "next/head";
import Link from "next/link";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { GUIDE_CATEGORIES, getGuidesByCategory } from "../../lib/guides";

export default function GuidesIndexPage() {
  const title = "Guide du bailleur : mettre en location et gérer un logement | lokt.fr";
  const description =
    "Guides pratiques pour préparer une location, accueillir un locataire, suivre le bail et organiser son départ : DPE, LMNP, charges, travaux et état des lieux.";

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://lokt.fr/guides" />
      </Head>
      <AppHeader />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Guide du bailleur</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Les repères utiles pour louer proprement, à chaque étape
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Des dossiers pratiques pour préparer les bons documents, sécuriser les moments importants et garder une gestion lisible dans la durée.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="grid gap-8">
            {GUIDE_CATEGORIES.map((category, index) => {
              const guides = getGuidesByCategory(category.key);
              return (
                <section key={category.key} id={category.key} className="scroll-mt-24">
                  <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-950">{category.label}</h2>
                      <p className="mt-1 text-sm text-slate-600">{category.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {guides.map((guide) => (
                      <Link
                        key={guide.slug}
                        href={`/guides/${guide.slug}`}
                        className="group border-l-4 border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-indigo-600 hover:shadow-md"
                      >
                        <div className="flex justify-end">
                          <span className="text-sm font-semibold text-indigo-700 transition group-hover:translate-x-0.5">Lire →</span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-950">{guide.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{guide.description}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            Ces guides donnent des repères généraux. Pour une décision juridique ou fiscale engageante, vérifiez votre situation auprès d’une ADIL,
            d’un professionnel du droit ou d’un expert-comptable.
          </p>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
