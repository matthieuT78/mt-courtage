// pages/quittances-loyer.tsx
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import Link from "next/link";

type Bien = {
  id: string;
  nomBien: string;
  adresseBien: string;
  locataireNom: string;
  locataireAdresse: string;
  loyerHC: number;
  charges: number;
  villeSignature: string;
};

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatEuro(val: number) {
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export default function QuittancesLoyerPage() {
  // Infos bailleur (globales)
  const [bailleurNom, setBailleurNom] = useState("");
  const [bailleurAdresse, setBailleurAdresse] = useState("");

  // Biens gérés
  const [biens, setBiens] = useState<Bien[]>([
    {
      id: "bien-1",
      nomBien: "Appartement T2 – Exemple",
      adresseBien: "12 rue de la Paix, 75002 Paris",
      locataireNom: "Nom du locataire",
      locataireAdresse: "Adresse du locataire",
      loyerHC: 800,
      charges: 100,
      villeSignature: "Paris",
    },
  ]);
  const [selectedBienId, setSelectedBienId] = useState<string>("bien-1");

  // Paramètres de la quittance générée
  const now = new Date();
  const [mois, setMois] = useState<number>(now.getMonth()); // 0-11
  const [annee, setAnnee] = useState<number>(now.getFullYear());
  const [dateSignature, setDateSignature] = useState<string>(
    now.toISOString().substring(0, 10)
  );

  const selectedBien = biens.find((b) => b.id === selectedBienId) || biens[0];

  // Montants versés (par défaut = montants contractuels)
  const [montantVerseLoyer, setMontantVerseLoyer] = useState<number>(
    selectedBien?.loyerHC ?? 0
  );
  const [montantVerseCharges, setMontantVerseCharges] = useState<number>(
    selectedBien?.charges ?? 0
  );

  const handleAddBien = () => {
    const id = `bien-${Date.now()}`;
    const newBien: Bien = {
      id,
      nomBien: "Nouveau bien",
      adresseBien: "",
      locataireNom: "",
      locataireAdresse: "",
      loyerHC: 0,
      charges: 0,
      villeSignature: "Paris",
    };
    setBiens((prev) => [...prev, newBien]);
    setSelectedBienId(id);
    setMontantVerseLoyer(0);
    setMontantVerseCharges(0);
  };

  const handleUpdateBien = (id: string, field: keyof Bien, value: string | number) => {
    setBiens((prev) =>
      prev.map((bien) =>
        bien.id === id
          ? {
              ...bien,
              [field]: field === "loyerHC" || field === "charges" ? Number(value) || 0 : value,
            }
          : bien
      )
    );
    if (id === selectedBienId) {
      if (field === "loyerHC") {
        setMontantVerseLoyer(Number(value) || 0);
      }
      if (field === "charges") {
        setMontantVerseCharges(Number(value) || 0);
      }
    }
  };

  const handleDeleteBien = (id: string) => {
    if (biens.length === 1) {
      alert("Vous devez garder au moins un bien.");
      return;
    }
    const ok = window.confirm(
      "Supprimer ce bien de la liste ? (Cette action n'efface pas vos documents existants, seulement cette configuration locale.)"
    );
    if (!ok) return;

    setBiens((prev) => prev.filter((b) => b.id !== id));
    if (selectedBienId === id) {
      const remaining = biens.filter((b) => b.id !== id);
      if (remaining[0]) {
        setSelectedBienId(remaining[0].id);
        setMontantVerseLoyer(remaining[0].loyerHC);
        setMontantVerseCharges(remaining[0].charges);
      }
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const totalVerse = (montantVerseLoyer || 0) + (montantVerseCharges || 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HERO */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3 print:hidden">
            <p className="text-[0.7rem] uppercase tracking-[0.20em] text-emerald-600">
              Quittances de loyer
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Générer des quittances de loyer professionnelles en quelques clics.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Gérez plusieurs biens, paramétrez vos locataires et obtenez une
              quittance prête à être envoyée par e-mail ou imprimée — avec les
              bons montants et la bonne période.
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-[0.75rem] text-slate-600">
              <Link
                href="/outils-proprietaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
              >
                ← Retour à la boîte à outils propriétaire
              </Link>
              <p className="text-[0.7rem] text-slate-500">
                Astuce : conservez cette page en favori si vous la consultez
                chaque mois.
              </p>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[260px,1fr]">
            {/* COLONNE GAUCHE : BAILLEUR + LISTE DE BIENS */}
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4 print:hidden">
              {/* Infos bailleur */}
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Vos informations (bailleur)
                </p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Nom / raison sociale
                    </label>
                    <input
                      type="text"
                      value={bailleurNom}
                      onChange={(e) => setBailleurNom(e.target.value)}
                      placeholder="Ex : Dupont Immobilier"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Adresse complète
                    </label>
                    <textarea
                      value={bailleurAdresse}
                      onChange={(e) => setBailleurAdresse(e.target.value)}
                      placeholder="Numéro, rue, code postal, ville"
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Biens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Biens loués
                  </p>
                  <button
                    type="button"
                    onClick={handleAddBien}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    + Ajouter un bien
                  </button>
                </div>

                <div className="space-y-1">
                  {biens.map((bien) => {
                    const isActive = bien.id === selectedBienId;
                    return (
                      <button
                        key={bien.id}
                        type="button"
                        onClick={() => {
                          setSelectedBienId(bien.id);
                          setMontantVerseLoyer(bien.loyerHC);
                          setMontantVerseCharges(bien.charges);
                        }}
                        className={
                          "group w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-left text-[0.75rem] " +
                          (isActive
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                        }
                      >
                        <span className="truncate mr-2">
                          {bien.nomBien || "Bien sans nom"}
                        </span>
                        {biens.length > 1 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBien(bien.id);
                            }}
                            className="text-[0.7rem] text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Supprimer ce bien"
                          >
                            ✕
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* COLONNE DROITE : FORM + APERÇU QUITTANCE */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
              {/* Configuration du bien sélectionné */}
              {selectedBien && (
                <div className="space-y-3 print:hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                        Bien & locataire
                      </p>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Paramètres du bien sélectionné
                      </h2>
                    </div>
                    <p className="text-[0.7rem] text-slate-500">
                      Les infos ci-dessous sont propres à ce bien uniquement.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Nom du bien
                        </label>
                        <input
                          type="text"
                          value={selectedBien.nomBien}
                          onChange={(e) =>
                            handleUpdateBien(
                              selectedBien.id,
                              "nomBien",
                              e.target.value
                            )
                          }
                          placeholder="Ex : T2 Lyon – Rue des Fleurs"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Adresse du bien
                        </label>
                        <textarea
                          value={selectedBien.adresseBien}
                          onChange={(e) =>
                            handleUpdateBien(
                              selectedBien.id,
                              "adresseBien",
                              e.target.value
                            )
                          }
                          placeholder="Adresse complète du logement loué"
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Nom du locataire
                        </label>
                        <input
                          type="text"
                          value={selectedBien.locataireNom}
                          onChange={(e) =>
                            handleUpdateBien(
                              selectedBien.id,
                              "locataireNom",
                              e.target.value
                            )
                          }
                          placeholder="Ex : Mme Martin"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Adresse du locataire (facultatif)
                        </label>
                        <textarea
                          value={selectedBien.locataireAdresse}
                          onChange={(e) =>
                            handleUpdateBien(
                              selectedBien.id,
                              "locataireAdresse",
                              e.target.value
                            )
                          }
                          placeholder="Adresse actuelle du locataire"
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Loyer hors charges (mensuel)
                      </label>
                      <input
                        type="number"
                        value={selectedBien.loyerHC}
                        onChange={(e) =>
                          handleUpdateBien(
                            selectedBien.id,
                            "loyerHC",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Provisions / charges (mensuel)
                      </label>
                      <input
                        type="number"
                        value={selectedBien.charges}
                        onChange={(e) =>
                          handleUpdateBien(
                            selectedBien.id,
                            "charges",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Ville de signature
                      </label>
                      <input
                        type="text"
                        value={selectedBien.villeSignature}
                        onChange={(e) =>
                          handleUpdateBien(
                            selectedBien.id,
                            "villeSignature",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Paramètres de la quittance */}
              <div className="space-y-3 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Période & montant versé
                    </p>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Paramétrer la quittance à générer
                    </h2>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Mois concerné
                    </label>
                    <select
                      value={mois}
                      onChange={(e) => setMois(parseInt(e.target.value, 10))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {MOIS.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Année
                    </label>
                    <input
                      type="number"
                      value={annee}
                      onChange={(e) =>
                        setAnnee(parseInt(e.target.value, 10) || annee)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Date de signature / émission
                    </label>
                    <input
                      type="date"
                      value={dateSignature}
                      onChange={(e) => setDateSignature(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Loyer reçu (hors charges)
                    </label>
                    <input
                      type="number"
                      value={montantVerseLoyer}
                      onChange={(e) =>
                        setMontantVerseLoyer(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[0.7rem] text-slate-400">
                      Laissez égal au loyer contractuel si tout a été payé.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Charges reçues
                    </label>
                    <input
                      type="number"
                      value={montantVerseCharges}
                      onChange={(e) =>
                        setMontantVerseCharges(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[0.7rem] text-slate-400">
                      Mettre à jour en cas de régularisation ou d&apos;impayé.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Total versé
                    </label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900">
                      {formatEuro(totalVerse)}
                    </div>
                    <p className="text-[0.7rem] text-slate-400">
                      Somme indiquée comme payée dans la quittance.
                    </p>
                  </div>
                </div>
              </div>

              {/* APERÇU / VERSION IMPRIMABLE */}
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-xs sm:text-sm text-slate-900 print:border-0 print:shadow-none print:px-0 print:bg-white">
                <div className="flex items-center justify-between gap-3 mb-4 print:flex-row">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      Aperçu de la quittance
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      Quittance pour le mois de {MOIS[mois]} {annee}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="print:hidden inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Imprimer / enregistrer en PDF
                  </button>
                </div>

                <div className="border border-slate-300 rounded-xl px-4 py-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                    <div className="text-[0.8rem]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-slate-700 mb-1">
                        QUITTANCE DE LOYER
                      </p>
                      <p>
                        Pour la période : <strong>{MOIS[mois]} {annee}</strong>
                      </p>
                    </div>
                    <div className="text-[0.75rem] text-slate-700">
                      {selectedBien?.villeSignature && (
                        <p>
                          Fait à {selectedBien.villeSignature}
                          {dateSignature && `, le ${new Date(dateSignature).toLocaleDateString("fr-FR")}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-[0.75rem]">
                    <div>
                      <p className="font-semibold mb-1">Bailleur</p>
                      <p>{bailleurNom || "Nom du bailleur"}</p>
                      {bailleurAdresse && (
                        <p className="whitespace-pre-line">{bailleurAdresse}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Locataire</p>
                      <p>{selectedBien?.locataireNom || "Nom du locataire"}</p>
                      {selectedBien?.locataireAdresse && (
                        <p className="whitespace-pre-line">
                          {selectedBien.locataireAdresse}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[0.75rem] space-y-2">
                    <p>
                      Logement loué :{" "}
                      <span className="font-semibold">
                        {selectedBien?.nomBien || "Bien sans nom"}
                      </span>
                    </p>
                    <p className="whitespace-pre-line">
                      Adresse :{" "}
                      {selectedBien?.adresseBien ||
                        "Adresse complète du bien à compléter."}
                    </p>
                  </div>

                  <div className="text-[0.75rem] space-y-2">
                    <p>
                      Je soussigné(e){" "}
                      <strong>{bailleurNom || "Nom du bailleur"}</strong>,{" "}
                      reconnais avoir reçu de{" "}
                      <strong>
                        {selectedBien?.locataireNom || "Nom du locataire"}
                      </strong>{" "}
                      la somme totale de{" "}
                      <strong>{formatEuro(totalVerse)}</strong> ({" "}
                      {formatEuro(montantVerseLoyer)} de loyer hors charges et{" "}
                      {formatEuro(montantVerseCharges)} de provisions sur
                      charges ), en paiement du loyer et des charges pour le
                      mois de <strong>{MOIS[mois]} {annee}</strong>.
                    </p>
                    <p>
                      La présente quittance vaut pour{" "}
                      <strong>reçu de la somme indiquée</strong>, sans préjudice
                      des sommes restant éventuellement dues au titre
                      d&apos;impayés antérieurs, de régularisations de charges ou
                      de réparations locatives.
                    </p>
                  </div>

                  <div className="text-[0.75rem] mt-4">
                    <p className="mb-6">Signature du bailleur :</p>
                    <div className="h-12 border-b border-slate-300 w-64" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white print:hidden">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour
          propriétaires et investisseurs.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
