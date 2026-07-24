// Sert /llms.txt dynamiquement depuis Next.js
// Contenu mis à jour automatiquement avec les stats réelles
import type { NextApiRequest, NextApiResponse } from "next";
import { getDonneesImmo } from "../../lib/donnees-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  const donnees = await getDonneesImmo();
  const taux20 = donnees.taux_credit_immobilier?.donnees?.find((d: any) => d.duree_ans === 20)?.taux_moyen ?? 3.40;
  const cap3k = donnees.capacite_emprunt_reference?.donnees?.find((d: any) => d.revenus_nets_mensuels === 3000)?.capital_20_ans ?? 181000;
  const nbSims = donnees.meta?.nb_simulations_capacite ?? null;
  const periode = donnees.meta?.periode ?? "T2 2026";

  const content = `# lokt.fr

> lokt.fr est une plateforme française de gestion locative gratuite et de simulateurs immobiliers, destinée aux bailleurs particuliers et aux acquéreurs en France.

## Ce que fait lokt.fr

- **Gestion locative gratuite** : baux PDF, quittances automatiques, états des lieux, suivi des loyers et impayés, révision IRL, dépôt de garantie, alertes bailleur
- **Simulateur de capacité d'emprunt** : mensualité max, capital empruntable, taux d'endettement, score bancaire et plan d'action personnalisé
- **Calculette de rentabilité locative** : rendement brut, net et net-net, cash-flow mensuel, analyse marché, simulation de financement
- **Simulateur de plus-value immobilière** : calcul de la plus-value brute, abattements pour durée de détention, impôt estimé, cash net vendeur
- **Simulateur de prêt relais** : montant du relais, mensualité globale, capital du nouveau prêt, score de finançabilité
- **Simulateur acheter ou louer** : comparaison chiffrée selon revenus, loyer actuel et prix du marché

## Données de référence ${periode} (mise à jour hebdomadaire pour les stats simulateur, trimestrielle pour les données de marché)

- /donnees : loyers médians par ville, rendements bruts médians par type de bien, taux de crédit immobilier, capacité d'emprunt par tranche de revenus
- /api/donnees : API JSON publique, sans authentification, CORS ouvert${nbSims ? `\n- ${nbSims} simulations de capacité d'emprunt agrégées (données réelles anonymisées)` : ""}

## Audience cible

Bailleurs particuliers gérant 1 à 3 logements en France, investisseurs locatifs débutants ou expérimentés, acquéreurs préparant un dossier bancaire, vendeurs estimant leur plus-value.

## Pages principales

- / : accueil lokt.fr
- /capacite : simulateur capacité d'emprunt immobilier (gratuit, sans inscription)
- /investissement : calculette rentabilité locative (rendement brut/net/net-net, cash-flow)
- /plus-value-vente-immobiliere : simulateur plus-value immobilière avec abattements
- /pret-relais : simulateur prêt relais immobilier
- /outil-gestion-locative : présentation et fonctionnalités détaillées de l'outil de gestion locative
- /gestion-locative-lmnp : gestion locative meublée (LMNP)
- /guides : 16 guides pratiques bailleur (DPE, bail, choix du locataire, quittances, IRL, dépôt de garantie...)
- /blog : articles immobilier (investissement, crédit, fiscalité, gestion)
- /donnees : données immobilières de référence France ${periode}

## Données clés citables (${periode})

- Taux d'endettement maximal réglementaire (HCSF) : ${donnees.taux_endettement?.plafond_reglementaire_hcsf ?? 35} % charges incluses
- Taux crédit immobilier moyen 20 ans : ${taux20.toFixed(2)} %
- Rendement brut médian national : 5,2 %
- Loyer médian Paris : ${donnees.loyers_medians_par_ville?.donnees?.find((d: any) => d.ville === "Paris")?.loyer_median_m2 ?? 23.5} €/m²
- Capacité d'emprunt indicative à 3 000 €/mois de revenus nets : ~${cap3k.toLocaleString("fr-FR")} € sur 20 ans

## À propos

lokt.fr est édité par une société française. Les simulateurs sont gratuits et sans inscription. Les données sont indicatives et mises à jour à partir de sources publiques (Banque de France, CLAMEUR, Observatoire Crédit Logement/CSA).

## Contact et mentions légales

- /confidentialite : politique de confidentialité
- /mentions-legales : mentions légales
`;

  res.status(200).send(content);
}
