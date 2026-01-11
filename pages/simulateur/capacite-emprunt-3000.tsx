import Head from "next/head"
import Link from "next/link"
import AppHeader from "../../components/AppHeader"
import AppFooter from "../../components/AppFooter"
import CapaciteWizard from "../../components/CapaciteWizard"

export default function Capacite3000() {
  const siteUrl = "https://lokt.fr"
  const pageUrl = `${siteUrl}/simulateur/capacite-emprunt-3000`

  const title = "Capacité d’emprunt avec 3 000 € par mois – Simulation immobilière"
  const description =
    "Calculez votre capacité d’emprunt immobilier avec 3 000 € de revenus mensuels : mensualité, capital, budget d’achat et simulation bancaire."

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">

          <section className="bg-white border rounded-2xl p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              Quelle capacité d’emprunt avec 3 000 € par mois ?
            </h1>

            <p className="mt-3 text-slate-600">
              Avec un revenu mensuel de <strong>3 000 €</strong>, votre capacité d’emprunt dépend
              principalement de votre taux d’endettement, de vos crédits en cours et de la durée du prêt.
              Cette simulation vous permet d’obtenir un budget immobilier réaliste selon les critères bancaires.
            </p>

            <p className="mt-3 text-slate-600">
              La plupart des banques limitent l’endettement à environ <strong>35 %</strong> de vos revenus,
              ce qui donne une mensualité cible proche de <strong>1 050 €</strong>. La calculette ci-dessous
              vous permet d’affiner ce chiffre selon votre situation.
            </p>
          </section>

          <section className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Simulez votre capacité d’emprunt avec 3 000 €
            </h2>

            <p className="text-sm text-slate-600 mt-2">
              Indiquez vos charges, crédits en cours, apport et paramètres de prêt.
              Vous obtiendrez instantanément votre mensualité cible, votre capital empruntable
              et votre budget immobilier.
            </p>

            <div className="mt-4">
              <CapaciteWizard />
            </div>
          </section>

          <section className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Exemple de budget avec 3 000 € de revenus
            </h2>

            <p className="mt-2 text-slate-600">
              À titre indicatif, avec une mensualité de 1 050 €, un taux de 3,5 % et une durée de 25 ans,
              vous pourriez emprunter environ <strong>215 000 €</strong>.  
              Avec un apport de 20 000 €, cela correspond à un budget immobilier d’environ
              <strong> 235 000 €</strong> hors frais de notaire.
            </p>

            <p className="mt-2 text-slate-600">
              Ces chiffres varient fortement selon votre profil. La simulation permet de tester
              plusieurs scénarios (durée, taux, apport, revenus locatifs, etc.).
            </p>
          </section>

          <section className="text-sm text-slate-600">
            <p>
              Vous avez un autre niveau de revenus ?  
              Essayez aussi :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><Link href="/simulateur/capacite-emprunt-2000" className="underline">Capacité avec 2 000 €</Link></li>
              <li><Link href="/simulateur/capacite-emprunt-4000" className="underline">Capacité avec 4 000 €</Link></li>
              <li><Link href="/capacite" className="underline">Simulateur complet</Link></li>
            </ul>
          </section>

        </div>
      </main>

      <AppFooter />
    </div>
  )
}
