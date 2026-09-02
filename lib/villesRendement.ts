import { citySlug, parseCitySlug } from "./cityPriceSlug";

export type VilleData = {
  slug: string;
  name: string;
  region: string;
  prixM2: number;
  loyerM2: number;
  rendementBrut: number;
  tensionLocative: "forte" | "moyenne" | "modérée";
  descriptionMarche: string;
  analyses: string[]; // 2 paragraphes d'analyse étendue
  biensPerformants: Array<{ type: string; detail: string }>;
  quartiers: Array<{ nom: string; note: string }>;
  avantages: string[];
  vigilances: string[];
  population: string;
  villesProches: string[];
};

export const VILLES_DATA: VilleData[] = [
  {
    slug: "lyon",
    name: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    prixM2: 4800,
    loyerM2: 14,
    rendementBrut: 3.5,
    tensionLocative: "forte",
    descriptionMarche:
      "Lyon est le deuxième marché locatif de France avec 60 % de locataires dans son parc résidentiel. La correction des prix depuis 2022 (−10 à −15 %) a rouvert des opportunités dans les arrondissements périphériques, où les rendements dépassent à nouveau les 4 %. La demande étudiante et les cadres en mobilité professionnelle soutiennent une vacance locative quasi nulle.",
    analyses: [
      "Le profil locataire lyonnais est l'un des plus diversifiés de France. Les 160 000 étudiants et apprentis (Universités Lyon 1, 2, 3, INSA, EM Lyon, Sciences Po) forment le socle de la demande pour les petites surfaces. Les cadres en mobilité alimentent le marché des T2 meublés dans les quartiers d'affaires (Part-Dieu, Confluence), tandis que les familles stabilisent la demande de T3 dans les 7e et 8e arrondissements. Ce triptyque étudiants/actifs/familles protège Lyon d'une dépendance à un seul profil de locataire.",
      "La correction des prix 2022-2024 offre une opportunité rare : les rendements bruts sont remontés dans les arrondissements périphériques alors que la demande locative n'a pas faibli. La stratégie la plus solide en 2026 reste le studio ou T2 meublé en LMNP réel dans un arrondissement desservi par le métro ou le tramway. Villeurbanne concentre le meilleur équilibre : prix −20 % par rapport au centre, mêmes loyers au m², et accès direct aux pôles universitaires.",
    ],
    biensPerformants: [
      { type: "Studio 20-28 m²", detail: "Forte demande étudiante, rotation rapide, rendement 4-5 % dans les 7e, 8e et Villeurbanne." },
      { type: "T2 meublé 30-45 m²", detail: "Cible cadres et jeunes actifs, loyers stables, idéal en LMNP." },
      { type: "T3 en colocation", detail: "Particulièrement performant en 3e et 7e arrondissement, proches des grandes écoles." },
    ],
    quartiers: [
      { nom: "Villeurbanne", note: "Moins cher que Lyon intra-muros, transports directs, forte population étudiante." },
      { nom: "Gerland (7e)", note: "Quartier en transformation, prix encore abordables, accès métro ligne B." },
      { nom: "Part-Dieu (3e)", note: "Quartier d'affaires dynamique, forte demande de T2 meublés pour cadres." },
      { nom: "Vieux-Lyon (5e)", note: "Prestige et tourisme, adapté à la location courte durée réglementée." },
    ],
    avantages: [
      "Vacance locative quasi nulle grâce à la forte demande étudiante et professionnelle",
      "Marché profond et liquide — revente facilitée",
      "Correction de prix 2022-2024 a réduit les points d'entrée",
    ],
    vigilances: [
      "Rendement brut sous 4 % dans les 1er, 2e et 6e arrondissements centraux",
      "Prix au m² toujours parmi les plus élevés hors Paris et Nice",
      "Encadrement des loyers non appliqué en 2026 mais à surveiller",
    ],
    population: "530 000 habitants",
    villesProches: ["grenoble", "angers", "clermont-ferrand"],
  },
  {
    slug: "bordeaux",
    name: "Bordeaux",
    region: "Nouvelle-Aquitaine",
    prixM2: 4000,
    loyerM2: 13,
    rendementBrut: 3.9,
    tensionLocative: "forte",
    descriptionMarche:
      "Bordeaux a subi une forte correction des prix depuis son pic de 2021 (−15 à −20 %) après une décennie de hausse liée à l'arrivée de la LGV. Le marché s'est normalisé, retrouvant des niveaux accessibles. La demande reste soutenue par l'université (100 000 étudiants) et l'attractivité du bassin d'emploi.",
    analyses: [
      "Le marché locatif bordelais repose sur une base solide : 100 000 étudiants dans 5 universités et grandes écoles (Bordeaux Montaigne, Sciences Po, INSA...), un bassin d'emploi dynamique dans le vin, l'aéronautique (Thales, Dassault) et le numérique, et un flux constant de cadres en mobilité attirés par la qualité de vie. La LGV (Paris-Bordeaux en 2h05) continue d'alimenter l'attractivité de la ville auprès des actifs franciliens qui arbitrent qualité de vie et coût du logement.",
      "La correction de −15 à −20 % depuis le pic de 2021 a assaini un marché qui s'était emballé. En 2026, Bordeaux retrouve des niveaux de valorisation cohérents avec ses fondamentaux. Les opportunités se concentrent dans les communes de la métropole (Talence, Pessac, Mérignac) où les prix sont 25-35 % inférieurs au centre pour une demande locative quasi identique. L'encadrement des loyers est en vigueur dans la commune centre — vérifiez les loyers de référence avant tout achat, notamment pour les biens rénovés.",
    ],
    biensPerformants: [
      { type: "Studio 18-25 m²", detail: "Demande étudiante forte, rendements de 4-5 % dans les quartiers universitaires." },
      { type: "T2 30-45 m²", detail: "Segment le plus liquide, facilement relouable, adapté LMNP." },
      { type: "Immeuble de rapport", detail: "La correction a rendu certains petits immeubles accessibles, rendements nets intéressants." },
    ],
    quartiers: [
      { nom: "Bacalan / Bassins à flot", note: "Quartier en forte revalorisation, prix encore raisonnables, nouvelles infrastructures." },
      { nom: "Talence / Pessac", note: "Communes limitrophes, prix −30 % vs centre, demande étudiante identique." },
      { nom: "Saint-Michel", note: "En gentrification, bons rendements pour du T2/T3 rénové." },
      { nom: "Chartrons", note: "Quartier premium, revente assurée, loyers élevés mais prix d'entrée aussi." },
    ],
    avantages: [
      "Correction de prix significative — meilleures opportunités depuis 10 ans",
      "100 000 étudiants assurent une demande locative de fond",
      "Liquidité du marché à la revente reste excellente",
    ],
    vigilances: [
      "Encadrement des loyers en vigueur à Bordeaux depuis 2022 — vérifier les loyers de référence",
      "Attention aux passoires thermiques (DPE F/G) dont la location sera restreinte dès 2028",
      "Certains quartiers en transition présentent des risques de vacance",
    ],
    population: "260 000 habitants (métropole 800 000)",
    villesProches: ["toulouse", "nantes", "rennes"],
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    region: "Occitanie",
    prixM2: 3400,
    loyerM2: 13,
    rendementBrut: 4.6,
    tensionLocative: "forte",
    descriptionMarche:
      "Toulouse affiche l'un des meilleurs rapports rendement/risque des grandes métropoles françaises. Portée par le secteur aéronautique (Airbus, 100 000 emplois directs) et 130 000 étudiants, la ville combine prix encore accessibles et demande locative structurellement solide. La correction de prix y a été plus modérée qu'à Bordeaux ou Lyon.",
    analyses: [
      "Toulouse présente la base économique la plus robuste des grandes villes de province. Le secteur aéronautique et spatial emploie directement 100 000 personnes (Airbus, Safran, Thales, CNES) — un bassin d'ingénieurs et cadres stables qui génère une demande continue pour les T2-T3 dans les communes proches des sites industriels (Colomiers, Blagnac, Labège). Les 130 000 étudiants (Toulouse 3, Capitole, Jean Jaurès, Sciences Po) forment le deuxième pilier de la demande locative.",
      "La correction des prix à Toulouse a été plus modérée qu'à Bordeaux ou Lyon (−8 à −12 %), signe de fondamentaux économiques solides. Le marché reste accessible avec des rendements bruts de 4,5 à 5,5 % dans les bons secteurs. La stratégie recommandée : cibler les T2 meublés en LMNP à moins de 15 minutes du campus universitaire ou des sites Airbus, et éviter les zones inondables en bord de Garonne (Île du Ramier, Lalande). La colocation est particulièrement rentable dans les quartiers étudiants — rendement supérieur de 0,5 à 1 point vs location classique.",
    ],
    biensPerformants: [
      { type: "Studio / T2 meublé", detail: "130 000 étudiants — la demande pour les petites surfaces est quasi-illimitée." },
      { type: "T3 en colocation", detail: "Secteurs Paul Sabatier et Jean Jaurès : colocation 3 chambres très recherchée." },
      { type: "T4 familial en périphérie", detail: "Colomiers, Blagnac (proche Airbus) : forte demande de familles d'expatriés et cadres." },
    ],
    quartiers: [
      { nom: "Rangueil / Lespinet", note: "Proche campus Paul Sabatier, forte demande étudiante, prix raisonnables." },
      { nom: "Saint-Cyprien", note: "Quartier vivant en développement, bien desservi par le métro." },
      { nom: "Colomiers", note: "Commune proche d'Airbus, forte demande de cadres, prix inférieurs au centre." },
      { nom: "Compans-Cafarelli", note: "Quartier d'affaires, T2 meublés pour cadres en mobilité très demandés." },
    ],
    avantages: [
      "Rendement brut de 4,5-5 % accessible dans de nombreux quartiers",
      "Économie locale très solide (aéronautique, spatial, enseignement supérieur)",
      "Prix d'achat parmi les plus abordables des grandes métropoles",
    ],
    vigilances: [
      "Marché parfois tendu sur les bons produits — arbitrages rapides nécessaires",
      "Vigilance sur les zones inondables (bords de Garonne)",
      "DPE à vérifier : beaucoup de biens anciens énergivores dans le centre",
    ],
    population: "490 000 habitants",
    villesProches: ["bordeaux", "montpellier", "marseille"],
  },
  {
    slug: "marseille",
    name: "Marseille",
    region: "Provence-Alpes-Côte d'Azur",
    prixM2: 2900,
    loyerM2: 12,
    rendementBrut: 5.0,
    tensionLocative: "moyenne",
    descriptionMarche:
      "Marseille est l'une des rares grandes villes où les rendements bruts de 5 à 7 % restent accessibles. Le marché est très hétérogène : les écarts de prix entre arrondissements nord et sud atteignent un facteur 3. Une sélection rigoureuse de l'emplacement et du locataire est indispensable — le marché présente plus de risque que Lyon ou Toulouse en contrepartie de rendements élevés.",
    analyses: [
      "Marseille accueille une population de locataires parmi les plus diverses de France, avec de forts contrastes entre arrondissements. Le Sud et l'Est (8e, 12e, 13e) concentrent les catégories socioprofessionnelles supérieures — cadres, professions libérales — avec des revenus stables et un bon comportement de paiement. Le Nord et le Centre (1er au 4e) offrent des prix d'achat très bas mais un profil locataire moins homogène, qui nécessite une sélection rigoureuse et idéalement une assurance loyers impayés (GLI).",
      "Le rendement brut de 5 à 7 % accessible à Marseille est réel — mais il vient avec une prime de risque que les autres grandes villes n'ont pas. L'emplacement est encore plus critique ici qu'ailleurs : un investissement dans le 8e arrondissement se comporte très différemment d'un investissement dans le 3e, même pour un prix d'achat similaire. La stratégie la plus solide : cibler les T2/T3 rénovés dans les 8e, 12e et 13e arrondissements avec une GLI systématique. Les zones Euroméditerranée (2e, 15e) offrent un profil intermédiaire intéressant pour les investisseurs qui acceptent un peu plus d'incertitude pour un rendement supérieur.",
    ],
    biensPerformants: [
      { type: "T2/T3 rénové en secteur résidentiel", detail: "8e et 12e arrondissements : population stable, loyers corrects, risque limité." },
      { type: "Studio étudiant centre", detail: "Proximité Aix-Marseille Université, demande soutenue dans les 1er, 5e et 6e." },
      { type: "Bien en courte durée (secteur touristique)", detail: "Vieux-Port, Corniche : revenus Airbnb élevés mais réglementation à surveiller." },
    ],
    quartiers: [
      { nom: "8e arrondissement", note: "Résidentiel premium, locataires stables, prix plus élevés mais sécurisé." },
      { nom: "5e / 6e arrondissement", note: "Proche universités et hôpitaux, bonne demande, prix modérés." },
      { nom: "13e arrondissement", note: "Familial en développement, prix très accessibles, rendements attractifs." },
      { nom: "La Joliette / Euroméditerranée", note: "Quartier d'affaires en transformation, T2 meublés pour cadres en mobilité." },
    ],
    avantages: [
      "Rendements bruts de 5-7 % — parmi les plus élevés des grandes villes",
      "Prix au m² parmi les plus bas des métropoles françaises",
      "Dynamique économique et touristique forte",
    ],
    vigilances: [
      "Marché très hétérogène : l'emplacement est décisif",
      "Sélection du locataire à soigner — risque d'impayés supérieur à la moyenne nationale",
      "Bâti ancien parfois dégradé : diagnostics et travaux à anticiper",
    ],
    population: "870 000 habitants",
    villesProches: ["montpellier", "nice", "toulouse"],
  },
  {
    slug: "rennes",
    name: "Rennes",
    region: "Bretagne",
    prixM2: 3700,
    loyerM2: 13,
    rendementBrut: 4.2,
    tensionLocative: "forte",
    descriptionMarche:
      "Rennes s'est imposée comme l'une des villes les plus attractives pour l'investissement locatif. Croissance démographique soutenue (+1 % par an), 75 000 étudiants et un tissu économique diversifié (tech, santé, agroalimentaire) créent une demande locative structurellement forte. La métropole est en tension permanente, avec des délais de relocation quasi nuls.",
    analyses: [
      "Rennes affiche l'une des plus fortes proportions d'étudiants par rapport à sa population (75 000 étudiants pour 225 000 habitants). Les trois campus — Villejean (Rennes 2), Beaulieu (Rennes 1, INSA) et Saint-Jacques — créent des bassins de demande distincts selon les secteurs. À ces étudiants s'ajoutent les cadres du secteur numérique (Rennes est le 4e pôle tech de France après Paris, Lyon et Sophia Antipolis) et les fonctionnaires d'État, nombreux dans les administrations régionales.",
      "Contrairement à d'autres grandes métropoles, les prix rennais n'ont pas significativement corrigé depuis 2022, ce qui témoigne de la solidité de la demande mais limite mécaniquement les rendements. En 2026, un rendement brut de 4-4,5 % est accessible dans les quartiers étudiants, et 3,5-4 % en centre-ville. L'encadrement des loyers est entré en vigueur en 2024 à Rennes — il est impératif de vérifier les loyers de référence avant tout achat. L'investissement le plus sûr reste le studio dans les 500 mètres d'un campus ou d'une station de métro.",
    ],
    biensPerformants: [
      { type: "Studio / T1 bis étudiant", detail: "Proximité Rennes 1 et 2, campus Villejean et Beaulieu — vacance quasi nulle." },
      { type: "T2 meublé", detail: "Cible jeunes actifs du secteur tech, rendements stables autour de 4-4,5 %." },
      { type: "T3 colocation", detail: "Forte demande, particulièrement dans les quartiers étudiants." },
    ],
    quartiers: [
      { nom: "Villejean / Beauregard", note: "Campus Rennes 1 — forte demande étudiante, prix accessibles." },
      { nom: "Beaulieu", note: "Pôle sciences et INSA, excellente demande pour studios et T2." },
      { nom: "Cleunay / Blosne", note: "Prix inférieurs au centre, desserte métro, revalorisation progressive." },
      { nom: "Centre / Thabor", note: "Premium, revente assurée, loyers élevés — investisseur patrimonial." },
    ],
    avantages: [
      "Tension locative parmi les plus fortes de France hors Paris",
      "Croissance démographique et économique qui soutient la demande à long terme",
      "Qualité de vie élevée = maintien de la valeur patrimoniale",
    ],
    vigilances: [
      "Prix au m² en hausse — la correction nationale a peu impacté Rennes",
      "Compétition forte à l'achat : les bons produits partent vite",
      "Encadrement des loyers entré en vigueur en 2024 — vérifier les loyers de référence",
    ],
    population: "225 000 habitants (métropole 450 000)",
    villesProches: ["nantes", "angers", "bordeaux"],
  },
  {
    slug: "nantes",
    name: "Nantes",
    region: "Pays de la Loire",
    prixM2: 3800,
    loyerM2: 13,
    rendementBrut: 4.1,
    tensionLocative: "forte",
    descriptionMarche:
      "Nantes a connu une forte croissance des prix (2015-2022) suivie d'une correction modérée. La ville reste très attractive grâce à sa démographie positive, ses 60 000 étudiants et son tissu économique dynamique (aéronautique, numérique, santé). La demande locative est soutenue avec des délais de relocation courts.",
    analyses: [
      "Nantes concentre les attributs d'une grande ville d'investissement solide : croissance démographique (+1,3 % par an depuis 10 ans), 60 000 étudiants dans des établissements de prestige (Centrale, Audencia, Sciences Po Atlantique), et un tissu économique très diversifié (aéronautique Airbus Saint-Nazaire, numérique, agroalimentaire, santé). Le locataire nantais est statistiquement plus stable et mieux rémunéré que dans d'autres grandes villes, ce qui se traduit par un très faible taux d'impayés.",
      "L'Île de Nantes est la zone à surveiller en priorité : quartier en pleine transformation avec des programmes neufs et une desserte en tramway, les prix restent encore 15-20 % sous le centre-ville pour des loyers identiques. Les communes limitrophes (Rezé, Saint-Sébastien-sur-Loire, Orvault) offrent des prix sensiblement inférieurs avec un accès en tramway direct au centre — la stratégie idéale pour un premier investissement locatif avec un budget sous 200 000 €. À noter : Nantes ne dispose pas encore d'encadrement des loyers, contrairement à Bordeaux et Rennes.",
    ],
    biensPerformants: [
      { type: "T2 meublé 30-45 m²", detail: "Fort turnover de jeunes actifs et étudiants, meilleur compromis rendement/risque." },
      { type: "Studio étudiant", detail: "Universités et grandes écoles (Centrale, Audencia) génèrent une demande constante." },
      { type: "T3 en hypercentre rénové", detail: "Loyers élevés, locataires stables, forte liquidité à la revente." },
    ],
    quartiers: [
      { nom: "Île de Nantes", note: "En transformation rapide, nouveaux programmes, prix encore abordables." },
      { nom: "Zola / Dervallières", note: "Populaire et bien desservi, entrées de prix attractives." },
      { nom: "Saint-Félix / Hauts-Pavés", note: "Résidentiels prisés, bonne demande de T2/T3, revente facilitée." },
      { nom: "Rezé / Saint-Sébastien", note: "Communes limitrophes, prix −20 % vs centre, tramway direct." },
    ],
    avantages: [
      "Ville la plus dynamique démographiquement des grandes métropoles de l'Ouest",
      "Tissu économique diversifié — moins sensible aux chocs sectoriels",
      "Marché locatif fluide avec peu de vacance",
    ],
    vigilances: [
      "Prix d'achat en centre-ville peu compatibles avec des rendements élevés",
      "Attention aux zones inondables en bord de Loire (PLU à vérifier)",
      "Encadrement des loyers potentiellement en discussion pour la métropole",
    ],
    population: "320 000 habitants (métropole 660 000)",
    villesProches: ["rennes", "angers", "bordeaux"],
  },
  {
    slug: "strasbourg",
    name: "Strasbourg",
    region: "Grand Est",
    prixM2: 3100,
    loyerM2: 13,
    rendementBrut: 5.0,
    tensionLocative: "forte",
    descriptionMarche:
      "Strasbourg combine des prix au m² modérés et une demande locative exceptionnellement forte grâce à ses 60 000 étudiants, ses institutions européennes (Parlement, Conseil de l'Europe) et son bassin d'emploi dans la santé et l'industrie. Le marché locatif est parmi les plus tendus d'Europe à l'échelle de sa taille.",
    analyses: [
      "La spécificité strasbourgeoise tient à la coexistence de deux marchés locatifs distincts : le marché de masse (60 000 étudiants à l'Université de Strasbourg) et le marché premium des fonctionnaires des institutions européennes (Parlement européen, Conseil de l'Europe, Cour des droits de l'Homme — 10 000 fonctionnaires internationaux). Ce second segment génère une demande de T2-T3 meublés premium dans le secteur Robertsau/Orangerie, avec des loyers nettement supérieurs à la moyenne et des locataires d'une grande stabilité.",
      "Strasbourg est l'une des villes françaises où la correction des prix a été la plus limitée (−7 à −10 % depuis 2022), soutenue par la pression de la demande étudiante et institutionnelle. En 2026, le marché offre encore des opportunités de rendement brut de 5 à 6 % dans les quartiers de Neudorf, Hautepierre et Cronenbourg. L'encadrement des loyers est en vigueur — les loyers de référence sont consultables sur le site de la préfecture du Bas-Rhin. La forte demande locative compense largement la contrainte de l'encadrement pour les investisseurs qui sélectionnent des biens en dessous du loyer de référence majoré.",
    ],
    biensPerformants: [
      { type: "Studio / T1 étudiant", detail: "Neudorf, Cronenbourg : demande étudiante massive, vacance quasi nulle." },
      { type: "T2 meublé pour fonctionnaire européen", detail: "Secteur Orangerie : locataires stables, loyers premium, turnover faible." },
      { type: "T3 colocation étudiante", detail: "Forte demande, rendements supérieurs à la location classique." },
    ],
    quartiers: [
      { nom: "Neudorf", note: "Quartier étudiant par excellence, prix accessibles, forte demande." },
      { nom: "Hautepierre / Cronenbourg", note: "Prix très bas, rénovation urbaine en cours, opportunités de rendement élevé." },
      { nom: "Robertsau / Orangerie", note: "Quartier des institutions européennes, locataires premium, loyers stables." },
      { nom: "Koenigshoffen", note: "Desserte tram directe, prix modérés, bonne demande famille/étudiants." },
    ],
    avantages: [
      "Rendements bruts de 5 à 6 % accessibles dans plusieurs quartiers",
      "Marché locatif parmi les plus tendus — vacance quasi inexistante",
      "Profil de locataires diversifié (étudiants, fonctionnaires européens, cadres)",
    ],
    vigilances: [
      "Encadrement des loyers en vigueur — vérifier les loyers de référence par zone",
      "Bâti ancien souvent énergivore (immeubles haussmanniens, isolation à prévoir)",
      "Concurrence frontalière avec l'Allemagne pour certains profils de locataires",
    ],
    population: "290 000 habitants (Eurométropole 500 000)",
    villesProches: ["nancy", "metz", "mulhouse"],
  },
  {
    slug: "lille",
    name: "Lille",
    region: "Hauts-de-France",
    prixM2: 3000,
    loyerM2: 13,
    rendementBrut: 5.2,
    tensionLocative: "forte",
    descriptionMarche:
      "Lille offre l'un des meilleurs profils rendement/risque des métropoles françaises. Avec 120 000 étudiants (deuxième concentration étudiante de France), une position de carrefour européen (1h de Paris, 35 min de Bruxelles) et des prix modérés, la ville cumule les atouts. La vacance est rarissime dans les bons secteurs.",
    analyses: [
      "Lille dispose du marché étudiant le plus profond de France hors Paris, avec 120 000 étudiants répartis dans 5 grandes universités et écoles (Lille, Polytechnique Hauts-de-France, Sciences Po, EDHEC, Kedge). À ce socle s'ajoutent les travailleurs transfrontaliers belges (10 000+ navettes/jour), les cadres des grandes entreprises nordistes (Auchan, Decathlon, Leroy Merlin, Bonduelle) et un flux de jeunes actifs attirés par des loyers nettement inférieurs à Paris pour une accessibilité en 1 heure.",
      "Avec des prix au m² parmi les plus bas des grandes métropoles françaises (3 000 €/m² en moyenne) et une demande locative structurellement forte, Lille offre l'une des meilleures combinaisons rendement/risque du pays. L'encadrement des loyers, en vigueur depuis 2020, est un paramètre à intégrer — mais les loyers de référence sont globalement bien alignés avec les prix de marché dans les quartiers étudiants. Le bâti nord-européen présente souvent des performances énergétiques insuffisantes (DPE E/F) : prévoir un budget travaux de 15 000 à 40 000 € pour éviter les restrictions de location futures.",
    ],
    biensPerformants: [
      { type: "Studio étudiant 18-25 m²", detail: "120 000 étudiants pour une offre insuffisante — les studios se louent en quelques heures." },
      { type: "T2 meublé", detail: "Jeunes actifs et travailleurs transfrontaliers — très demandés." },
      { type: "Colocation T3/T4", detail: "Particulièrement rentable dans Vauban, Wazemmes, Moulins." },
    ],
    quartiers: [
      { nom: "Vauban / Wazemmes", note: "Quartier étudiant par excellence, prix accessibles, vacance quasi nulle." },
      { nom: "Euralille / Saint-Maurice", note: "Quartier d'affaires en développement, T2 meublés très demandés." },
      { nom: "Moulins", note: "En gentrification, prix bas, potentiel de revalorisation à moyen terme." },
      { nom: "Lomme / Lambersart", note: "Communes limitrophes résidentielles, prix −25 %, métro direct." },
    ],
    avantages: [
      "Rendements bruts de 5 à 6 % avec prix parmi les plus bas des métropoles",
      "120 000 étudiants = marché locatif le plus dynamique de France hors Paris",
      "Position stratégique — carrefour Paris/Bruxelles/Londres",
    ],
    vigilances: [
      "Encadrement des loyers en vigueur à Lille depuis 2020",
      "Certains quartiers périphériques présentent des risques de vacance",
      "Bâti ancien souvent énergivore — DPE à vérifier impérativement",
    ],
    population: "240 000 habitants (Métropole 1,2M)",
    villesProches: ["roubaix", "strasbourg", "metz"],
  },
  {
    slug: "montpellier",
    name: "Montpellier",
    region: "Occitanie",
    prixM2: 3500,
    loyerM2: 13,
    rendementBrut: 4.5,
    tensionLocative: "forte",
    descriptionMarche:
      "Montpellier est la métropole française à la croissance démographique la plus rapide (+1,5 % par an depuis 20 ans). Ses 80 000 étudiants, l'attractivité climatique et un tissu économique en expansion (numérique, santé, biotech) créent une pression locative durable. Le marché a bien résisté à la correction nationale grâce à cette demande structurelle.",
    analyses: [
      "Montpellier attire des profils locataires très variés grâce à son positionnement unique : ville étudiante (80 000 étudiants, dont 30 000 à la Faculté de Médecine et Pharmacie, première d'Europe par ses effectifs), ville de cadres tech et de la santé (Sanofi, IBM, Dell, Cap Gemini), et destination de retraite active pour les Parisiens et Nordistes cherchant le soleil. Cette diversité protège l'investisseur d'un effondrement locatif en cas de choc sectoriel.",
      "Montpellier a peu corrigé malgré la hausse des taux d'intérêt (−5 à −8 % seulement depuis 2022), portée par une demande démographique structurelle exceptionnelle. La stratégie optimale : cibler les communes proches du tramway (Lattes, Juvignac, Castelnau-le-Lez) où les prix sont 20-30 % inférieurs pour des loyers comparables. Les biens avec extérieur (terrasse, jardin) commandent une prime de 10-15 % sur les loyers — un différenciateur important dans ce marché très demandé.",
    ],
    biensPerformants: [
      { type: "Studio étudiant", detail: "Faculté de Médecine et universités Paul Valéry — demande très forte." },
      { type: "T2 meublé", detail: "Cadres en mobilité et jeunes actifs, forte demande, turnover modéré." },
      { type: "T3 avec extérieur (terrasse/jardin)", detail: "L'attrait du sud génère une prime de 10-15 % pour les biens avec extérieur." },
    ],
    quartiers: [
      { nom: "Antigone / Port Marianne", note: "Modernes, bien desservis par le tramway, demande stable et qualitative." },
      { nom: "Écusson (hypercentre)", note: "Historique et prisé, loyers élevés, forte valeur patrimoniale." },
      { nom: "Hôpitaux-Facultés", note: "Étudiants en médecine et personnel hospitalier — demande constante." },
      { nom: "Croix d'Argent", note: "Résidentiel accessible, demande familiale stable, tramway direct." },
    ],
    avantages: [
      "Croissance démographique la plus soutenue de France — demande garantie à long terme",
      "Attractivité climatique — moins de vacance en été qu'ailleurs",
      "Marché jeune, revente facilitée par l'afflux continu de nouveaux arrivants",
    ],
    vigilances: [
      "Prix ont peu corrigé — rendements parfois limités en centre",
      "Risque climatique (sécheresse, inondations) à intégrer dans les diagnostics",
      "Encadrement des loyers potentiellement à venir",
    ],
    population: "300 000 habitants (métropole 470 000)",
    villesProches: ["marseille", "toulouse", "nice"],
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    region: "Auvergne-Rhône-Alpes",
    prixM2: 2600,
    loyerM2: 12,
    rendementBrut: 5.5,
    tensionLocative: "forte",
    descriptionMarche:
      "Grenoble présente un profil atypique : des prix au m² parmi les plus bas des grandes villes universitaires françaises combinés à une forte demande locative soutenue par 65 000 étudiants et un tissu économique de haute technologie (STMicroelectronics, Schneider Electric, CEA). Les rendements bruts de 5 à 6,5 % sont accessibles dans plusieurs secteurs.",
    analyses: [
      "Grenoble possède le tissu économique le plus technologique de France hors Paris : le CEA (20 000 chercheurs et salariés), STMicroelectronics, Schneider Electric, Soitec et des dizaines de PME high-tech forment un bassin d'emploi d'ingénieurs, chercheurs et techniciens qui génèrent une demande stable de T2-T3 meublés. Les 65 000 étudiants (Université Grenoble Alpes, Grenoble INP, Sciences Po, EM Grenoble) forment le deuxième pilier. La ville attire également les amoureux de la montagne (ski, alpinisme), ce qui peut générer des revenus complémentaires en courte durée hivernale.",
      "La réputation de certains quartiers grenoblois (Mistral, Village Olympique) crée parfois des opportunités avec des prix très bas, mais nécessite une sélection fine. Les secteurs sûrs pour débuter (Île Verte, Championnet, Flaubert) offrent des rendements bruts de 5-5,5 % avec un profil de locataires fiable. L'accès au tram est déterminant pour la valeur locative à Grenoble : un T2 à 5 minutes à pied d'un arrêt se loue 10-15 % plus cher qu'un bien non desservi. Grenoble est l'une des rares grandes villes sans encadrement des loyers en 2026.",
    ],
    biensPerformants: [
      { type: "Studio étudiant", detail: "65 000 étudiants pour une offre insuffisante — demande soutenue toute l'année." },
      { type: "T2 meublé proche tram", detail: "Chercheurs, ingénieurs et personnels du CEA/INRIA — locataires très stables." },
      { type: "T3 familial rénové", detail: "Population stable dans les quartiers résidentiels, faible turnover." },
    ],
    quartiers: [
      { nom: "Île Verte", note: "Résidentiel prisé, prix corrects, bonne demande qualitative." },
      { nom: "Polygone Scientifique", note: "Proche universités et laboratoires, forte demande de chercheurs." },
      { nom: "Championnet / Alsace-Lorraine", note: "Centre-ville accessible, mixité étudiants/actifs, rendements >5 %." },
      { nom: "Échirolles", note: "Commune limitrophe, prix −20 %, desserte tram directe." },
    ],
    avantages: [
      "Prix d'achat parmi les plus bas des grandes villes universitaires — rendements >5 % accessibles",
      "Tissu économique tech unique (micro-électronique, recherche publique)",
      "Marché locatif tendu grâce à l'inadéquation offre/demande",
    ],
    vigilances: [
      "Image de certains quartiers à vérifier — sélection emplacement critique",
      "Marché à la revente plus étroit que Lyon ou Bordeaux",
      "Ville enclavée dans les Alpes — moins d'afflux de populations extérieures",
    ],
    population: "160 000 habitants (métropole 440 000)",
    villesProches: ["lyon", "angers", "clermont-ferrand"],
  },
  {
    slug: "angers",
    name: "Angers",
    region: "Pays de la Loire",
    prixM2: 2700,
    loyerM2: 11,
    rendementBrut: 4.9,
    tensionLocative: "forte",
    descriptionMarche:
      "Angers est souvent citée comme le meilleur équilibre rendement/qualité de vie de l'Ouest. Ses 45 000 étudiants, la croissance démographique et la bonne desserte TGV (35 min de Nantes, 1h30 de Paris) maintiennent une demande locative soutenue avec des rendements bruts proches de 5 %.",
    analyses: [
      "Angers se distingue par une qualité de vie exceptionnelle — régulièrement classée première ville de France où il fait bon vivre — qui génère une attractivité résidentielle durable. Les 45 000 étudiants de l'Université d'Angers, de l'ESTHUA et de l'ESEO alimentent la demande de petites surfaces. Le tissu économique — ETI et PME dans l'agroalimentaire, la santé (CHU 6 000 salariés) et les services — génère un flux de cadres stables. La proximité TGV en fait aussi une destination prisée pour les télétravailleurs cherchant un cadre de vie différent.",
      "Angers fait partie des marchés qui n'ont pas significativement corrigé pendant la période de hausse des taux, signe d'une demande réelle plutôt que spéculative. La stratégie la plus performante : cibler les biens en colocation meublée à proximité des campus (Belle-Beille, Saint-Serge). Un T3 de 65 m² bien divisé en 3 chambres peut générer 900 à 1 050 €/mois en colocation contre 700-750 € en location classique, améliorant le rendement de 20 à 30 % — particulièrement pertinent dans une ville à prix modéré.",
    ],
    biensPerformants: [
      { type: "Studio / T1 étudiant", detail: "45 000 étudiants dans une ville à taille humaine — concurrence moins forte qu'à Nantes." },
      { type: "T2 meublé", detail: "Fort turnover de jeunes actifs attirés par la qualité de vie." },
      { type: "T3 familial en secteur résidentiel", detail: "Population stable, faible vacance, idéal pour investisseur long terme." },
    ],
    quartiers: [
      { nom: "Belle-Beille / Erasme", note: "Quartier universitaire principal, forte demande, prix accessibles." },
      { nom: "Saint-Serge", note: "Proche campus ESTHUA et IUT, demande constante de studios." },
      { nom: "Centre-ville / La Doutre", note: "Premium, revente assurée, locataires stables, loyers supérieurs." },
      { nom: "Monplaisir", note: "Résidentiel familial, bonne demande de T3/T4, vacance limitée." },
    ],
    avantages: [
      "Meilleur équilibre rendement/qualité de vie de l'Ouest",
      "Prix d'achat modérés permettant des rendements proches de 5 %",
      "Dynamique démographique et économique positive sur long terme",
    ],
    vigilances: [
      "Marché moins liquide que Nantes ou Rennes à la revente",
      "Moins de grands employeurs — économie résidentielle dominante",
      "La correction nationale n'a pas vraiment touché Angers",
    ],
    population: "155 000 habitants (métropole 300 000)",
    villesProches: ["nantes", "rennes", "le-mans"],
  },
  {
    slug: "clermont-ferrand",
    name: "Clermont-Ferrand",
    region: "Auvergne-Rhône-Alpes",
    prixM2: 1900,
    loyerM2: 10,
    rendementBrut: 6.3,
    tensionLocative: "moyenne",
    descriptionMarche:
      "Clermont-Ferrand est la ville universitaire la moins chère de France pour des rendements parmi les plus élevés. Ses 40 000 étudiants, le siège de Michelin et un bassin médical important soutiennent une demande locative régulière. C'est la destination privilégiée des investisseurs qui recherchent un rendement maximal avec un ticket d'entrée minimal.",
    analyses: [
      "Clermont-Ferrand présente un profil locataire dominé par deux populations très stables : les 40 000 étudiants de l'Université Clermont Auvergne et les employés du groupe Michelin (20 000 salariés à Clermont, dont beaucoup de techniciens et ingénieurs en formation continue). Cette concentration sur deux grands pourvoyeurs de locataires est une force pour la stabilité, mais implique une dépendance à surveiller sur le long terme. Le coût de la vie très modéré maintient une forte attractivité pour les jeunes actifs souhaitant se loger qualitativement pour 400 à 550 €/mois.",
      "C'est à Clermont-Ferrand qu'un investisseur avec un budget sous 80 000 € peut acquérir un studio rentable et le louer immédiatement. Les petites surfaces (18-25 m²) dans le quartier universitaire Gaillard se négocient entre 40 000 et 65 000 €, avec des loyers de 350 à 450 €/mois — soit des rendements bruts de 7 à 8 %. Le risque principal est la liquidité à la revente : le marché des acquéreurs est moins profond qu'à Lyon ou Bordeaux, ce qui peut allonger les délais. L'horizon optimal d'investissement est de 8 à 12 ans minimum.",
    ],
    biensPerformants: [
      { type: "Studio étudiant 18-25 m²", detail: "Prix d'achat 35 000-65 000 €, rendements bruts de 7-8 % accessibles." },
      { type: "T2 rénové centre-ville", detail: "Cible étudiants et jeunes actifs Michelin, bon rendement, turnover modéré." },
      { type: "Immeuble de rapport", detail: "Petits immeubles très accessibles en prix, rendements nets performants." },
    ],
    quartiers: [
      { nom: "Gaillard / Les Salins", note: "Quartier universitaire, demande étudiante forte, prix très bas." },
      { nom: "La Plaine", note: "Proche Michelin, demande soutenue des employés et sous-traitants." },
      { nom: "Jaude / Centre", note: "Hypercentre commerçant, bonne demande, locataires actifs stables." },
      { nom: "Chamalières", note: "Commune résidentielle premium, familles stables, faible vacance." },
    ],
    avantages: [
      "Prix au m² parmi les plus bas de France pour une ville universitaire",
      "Rendements bruts de 6 à 8 % dans les bons secteurs",
      "Coût de la vie modéré — attractif pour les locataires à long terme",
    ],
    vigilances: [
      "Marché à la revente plus étroit — liquidité inférieure aux grandes métropoles",
      "Croissance économique et démographique plus faible",
      "Tension locative moyenne — davantage d'efforts sur la sélection",
    ],
    population: "145 000 habitants (métropole 330 000)",
    villesProches: ["lyon", "grenoble", "angers"],
  },
  {
    slug: "nancy",
    name: "Nancy",
    region: "Grand Est",
    prixM2: 2000,
    loyerM2: 11,
    rendementBrut: 6.6,
    tensionLocative: "moyenne",
    descriptionMarche:
      "Nancy offre le rendement brut le plus élevé de ce panorama avec des prix encore très bas. Ses 55 000 étudiants (une des plus fortes proportions de France par habitant), la qualité architecturale (Place Stanislas classée UNESCO) et le dynamisme du secteur santé soutiennent une demande locative fiable.",
    analyses: [
      "Nancy présente le ratio étudiants/population le plus élevé de ce comparatif : 55 000 étudiants pour 105 000 habitants, soit 52 %. Cette concentration exceptionnelle tient à la présence de l'Université de Lorraine (campus de Nancy) et de nombreuses grandes écoles (Mines Nancy, École des Beaux-Arts, ICN Business School, ENSAM). La place Stanislas, classée au patrimoine mondial de l'UNESCO, confère à la ville un prestige architectural qui soutient les valeurs immobilières et attire des profils de locataires qualitatifs — étudiants des grandes écoles et personnel médical du CHU.",
      "Les prix nancéiens ont stagné depuis 2020, ce qui signifie que les rendements sont restés élevés même pendant la correction nationale. En 2026, Nancy est l'une des rares grandes villes universitaires où il est encore possible d'acheter un T2 meublé sous 100 000 € dans un bon emplacement. La stratégie gagnante : acquérir un bien dans les quartiers Haussonville ou Blandan, à proximité d'un campus, et le louer meublé en LMNP. Le risque principal est la moindre liquidité à la revente comparé aux grandes métropoles du Sud ou de l'Ouest.",
    ],
    biensPerformants: [
      { type: "Studio étudiant", detail: "55 000 étudiants pour 105 000 habitants — ratio exceptionnel, demande quasi garantie." },
      { type: "T2 meublé en hypercentre", detail: "Place Stanislas et centre historique génèrent une forte demande résidentielle." },
      { type: "T3 rénové quartier universitaire", detail: "Colocation très répandue chez les étudiants, rendements nets intéressants." },
    ],
    quartiers: [
      { nom: "Haussonville / Blandan", note: "Quartier universitaire dense, prix très accessibles, forte demande étudiante." },
      { nom: "Centre Stanislas", note: "Prestige architectural unique, loyers premium, forte valeur patrimoniale." },
      { nom: "Rives de Meurthe", note: "Quartier en développement, programmes récents, prix modérés." },
      { nom: "Laxou / Vandœuvre", note: "Communes limitrophes avec campus universitaires, prix très bas, demande stable." },
    ],
    avantages: [
      "Rendements bruts parmi les plus élevés des villes universitaires françaises",
      "55 000 étudiants pour 105 000 habitants — proportion exceptionnelle",
      "Patrimoine architectural classé UNESCO qui soutient la valeur à long terme",
    ],
    vigilances: [
      "Marché à la revente limité — liquidité à anticiper",
      "Économie locale en reconversion — moins dynamique que les grandes métropoles",
      "Hétérogénéité forte entre quartiers — sélection fine requise",
    ],
    population: "105 000 habitants (métropole 260 000)",
    villesProches: ["metz", "strasbourg", "lille"],
  },
  {
    slug: "metz",
    name: "Metz",
    region: "Grand Est",
    prixM2: 2100,
    loyerM2: 10.5,
    rendementBrut: 6.0,
    tensionLocative: "moyenne",
    descriptionMarche:
      "Metz bénéficie d'une situation géographique exceptionnelle à 1h de Luxembourg (plus de 100 000 frontaliers dans la région). Cette position génère une demande locative originale : des travailleurs frontaliers qui logent en France pour des raisons fiscales ou de coût de la vie. Les rendements restent attractifs avec des prix d'entrée très abordables.",
    analyses: [
      "La particularité messine est son attractivité auprès des frontaliers luxembourgeois. Avec un SMIC luxembourgeois à 2 570 €/mois (vs 1 801 € en France en 2026), les travailleurs qui exercent au Luxembourg et logent à Metz bénéficient d'un pouvoir d'achat immobilier très supérieur à la moyenne française. Ce profil de locataire — solvable, rigoureux dans ses paiements, cherchant des T2/T3 bien situés — coexiste avec une demande étudiante de 35 000 personnes (Université de Lorraine, École de Design). Le Centre Pompidou-Metz (ouvert en 2010) a renforcé l'attractivité culturelle et touristique de la ville.",
      "Les prix messins sont parmi les plus stables de France depuis 10 ans, portés par la dynamique frontalière qui amortit les chocs économiques. En 2026, un T2 de 45 m² bien situé s'achète entre 80 000 et 120 000 € et se loue 530 à 600 €/mois. La stratégie optimale : cibler des biens dans le secteur Centre-ville/Sablon, bien desservis par les transports et dans un rayon de 20 minutes des frontières luxembourgeoises. Les quartiers périphériques moins accessibles (Borny, Bellecroix) offrent des rendements plus élevés mais un profil de risque supérieur.",
    ],
    biensPerformants: [
      { type: "T2/T3 pour frontaliers", detail: "Travailleurs au Luxembourg — profil solide, loyers payés rigoureusement." },
      { type: "Studio étudiant", detail: "35 000 étudiants à l'Université de Lorraine, campus Île du Saulcy." },
      { type: "T4 familial rénové", detail: "Familles stables, faible turnover, idéal pour investisseur long terme." },
    ],
    quartiers: [
      { nom: "Centre-ville / Pontiffroy", note: "Hypercentre historique, bonne demande, loyers corrects, valeur patrimoniale." },
      { nom: "Sablon", note: "Quartier résidentiel tranquille, familles stables, bonne desserte." },
      { nom: "Queuleu / Plantières", note: "Résidentiel accessible, prix très bas, demande familiale stable." },
      { nom: "Borny", note: "Prix très accessibles, rendements élevés, mais sélection rigoureuse indispensable." },
    ],
    avantages: [
      "Demande locative de frontaliers luxembourgeois — profil de locataires solide et fiable",
      "Prix au m² parmi les plus bas de France pour une ville régionale dynamique",
      "Position géographique stratégique avec forte dynamique transfrontalière",
    ],
    vigilances: [
      "Marché à la revente limité hors secteurs premium",
      "Économie locale moins diversifiée qu'une grande métropole",
      "Certains quartiers périphériques présentent des risques de vacance",
    ],
    population: "120 000 habitants (métropole 230 000)",
    villesProches: ["nancy", "strasbourg", "lille"],
  },
  {
    slug: "nice",
    name: "Nice",
    region: "Provence-Alpes-Côte d'Azur",
    prixM2: 5200,
    loyerM2: 16,
    rendementBrut: 3.7,
    tensionLocative: "forte",
    descriptionMarche:
      "Nice est un marché premium à fort potentiel de plus-value mais avec des rendements locatifs contraints par des prix élevés. La ville attire les investisseurs patrimoniaux plus que les chasseurs de rendement. Le marché de la courte durée y est très développé (tourisme international) et peut significativement améliorer les rendements pour les biens bien situés.",
    analyses: [
      "Nice accueille une population de locataires unique en France : une forte proportion d'étrangers (environ 15 % de la population), notamment des retraités européens (Britanniques, Scandinaves, Allemands) attirés par le climat et la qualité de vie, et des expatriés travaillant dans les grandes entreprises de la Côte d'Azur (Sophia Antipolis à 20 minutes). Ce profil génère une demande de logements de qualité, souvent meublés, avec des budgets supérieurs à la moyenne nationale. La demande touristique (5e destination touristique mondiale) crée également un marché de la courte durée très actif.",
      "Nice est une ville de stratégie patrimoniale, pas de rendement maximal. Les prix au m² élevés (5 000 à 8 000 €/m² selon les secteurs) compriment mécaniquement les rendements bruts, mais la valeur des biens a historiquement très bien résisté aux cycles. La stratégie la plus lucrative pour les biens bien situés reste la courte durée saisonnière : un T2 sur la Promenade des Anglais peut générer 30 000 à 50 000 €/an en revenu brut de location touristique, contre 12 000 à 15 000 € en longue durée. Attention : Nice applique des quotas sur les meublés de tourisme — renseignez-vous auprès de la mairie avant tout projet de courte durée.",
    ],
    biensPerformants: [
      { type: "Studio meublé pour tourisme", detail: "Promenade des Anglais et Vieux-Nice : courte durée avec bons revenus." },
      { type: "T2 meublé pour expatriés", detail: "Nice accueille beaucoup d'expatriés et retraités étrangers — locataires premium." },
      { type: "T3 résidence principale", detail: "Population stable, faible vacance, valeur patrimoniale assurée." },
    ],
    quartiers: [
      { nom: "Promenade / Vieux-Nice", note: "Premium absolu, tourisme international, courte durée très lucrative mais réglementée." },
      { nom: "Libération / Musiciens", note: "Résidentiels prisés, bonne demande, plus accessibles que le bord de mer." },
      { nom: "Saint-Isidore / Arenas", note: "Proche aéroport et zone économique, T2 pour actifs et expatriés." },
      { nom: "Cimiez", note: "Résidentiel haut de gamme, locataires stables et solvables." },
    ],
    avantages: [
      "Potentiel de plus-value patrimoniale fort — marché structurellement en tension",
      "Demande touristique internationale qui soutient la courte durée",
      "Locataires longue durée souvent de qualité (expatriés, retraités aisés)",
    ],
    vigilances: [
      "Rendements bruts parmi les plus bas — logique patrimoniale plus que rendement",
      "Réglementation courte durée (Airbnb) de plus en plus restrictive",
      "Prix d'entrée élevés — mise de fonds importante",
    ],
    population: "345 000 habitants",
    villesProches: ["marseille", "montpellier", "toulouse"],
  },
  {
    slug: "paris",
    name: "Paris",
    region: "Île-de-France",
    prixM2: 9600,
    loyerM2: 29,
    rendementBrut: 3.6,
    tensionLocative: "forte",
    descriptionMarche:
      "Paris reste le marché locatif le plus tendu de France avec un taux de vacance inférieur à 1 %. Malgré des prix parmi les plus élevés d'Europe, la demande structurelle — étudiants, expatriés, cadres en mobilité — maintient une pression locative exceptionnelle. La correction des prix 2022-2024 (−12 %) a légèrement amélioré les rendements dans les arrondissements périphériques, sans toutefois rattraper les niveaux de province.",
    analyses: [
      "Le marché parisien est structurellement sous-offreur : la ville compte 2,2 millions d'habitants pour un parc de logements quasi figé depuis 40 ans. Chaque année, 60 000 à 80 000 ménages cherchent un logement à Paris, pour une rotation du parc locatif privé de seulement 15 %. Cette tension permanente garantit une occupation quasi-continue des biens bien placés, mais comprime les rendements en raison de prix d'achat très élevés. L'encadrement des loyers (actif depuis 2019, renforcé en 2022) plafonne les loyers selon un indice de référence par quartier, type et ancienneté du bien — il est incontournable dans votre stratégie tarifaire.",
      "La stratégie la plus efficace à Paris en 2026 est le meublé en LMNP réel dans les arrondissements périphériques (13e, 18e, 19e, 20e), où les prix restent sous 9 000 €/m² et les rendements approchent les 4 %. Les studios et T2 meublés destinés aux étudiants (Sorbonne, Jussieu, Tolbiac, Montmartre) et aux jeunes actifs offrent la meilleure liquidité à la revente. Évitez les biens de moins de 9 m² (illégaux à la location), les DPE G (interdits depuis 2025) et privilégiez les copropriétés avec charges maîtrisées.",
    ],
    biensPerformants: [
      { type: "Studio 18-28 m²", detail: "Forte rotation, demande étudiante permanente, rendement 4-5 % dans les arrondissements périphériques." },
      { type: "T2 meublé 30-45 m²", detail: "Cible expatriés et jeunes cadres, baux mobilité ou meublé, idéal en LMNP réel." },
      { type: "T3 en colocation", detail: "Particulièrement performant dans les 18e et 19e pour divisions en chambres avec services." },
    ],
    quartiers: [
      { nom: "19e arrondissement", note: "Parmi les prix les plus abordables intra-muros, transports (lignes 5, 7, 11), forte demande locative." },
      { nom: "13e arrondissement", note: "Universités Paris-Cité et Panthéon-Sorbonne à proximité, quartiers rénovés, bon équilibre prix/rendement." },
      { nom: "18e arrondissement", note: "Montmartre : fort attrait locatif et touristique, prix hétérogènes, potentiel en location meublée." },
      { nom: "20e arrondissement", note: "Quartier résidentiel populaire, prix inférieurs à la moyenne parisienne, demande locative soutenue." },
    ],
    avantages: [
      "Vacance locative quasi nulle — occupation garantie toute l'année",
      "Valeur patrimoniale maximale et revente très liquide",
      "Demande internationale (étudiants, expatriés) qui soutient les loyers hauts de gamme",
    ],
    vigilances: [
      "Encadrement des loyers obligatoire — vérifier le loyer de référence avant achat",
      "Prix au m² parmi les plus élevés d'Europe — ticket d'entrée élevé, rendement comprimé",
      "Charges de copropriété souvent importantes dans les immeubles anciens haussmanniens",
      "DPE G interdit à la location depuis 2025 — vérifier l'étiquette énergie avant acquisition",
    ],
    population: "2 200 000 habitants",
    villesProches: ["lille", "lyon", "bordeaux"],
  },
  {
    slug: "le-mans",
    name: "Le Mans",
    region: "Pays de la Loire",
    prixM2: 1900,
    loyerM2: 11.5,
    rendementBrut: 7.3,
    tensionLocative: "modérée",
    descriptionMarche:
      "Le Mans combine des prix parmi les plus bas de l'Ouest et une desserte TGV vers Paris en 1h05 qui attire une population de pendulaires. Cette double dynamique — locataires locaux à revenus modestes et actifs travaillant à Paris — soutient un marché locatif stable avec des rendements bruts parmi les plus élevés des villes moyennes françaises.",
    analyses: [
      "La proximité TGV avec Paris (55 allers-retours quotidiens, trajet à 1h05) a changé la donne pour Le Mans depuis une dizaine d'années : une partie croissante des actifs locataires travaille à Paris tout en vivant au Mans, où le coût du logement reste 3 à 4 fois inférieur à la capitale. Ce profil de locataire, aux revenus parisiens mais au loyer provincial, est particulièrement solvable. En parallèle, l'Université du Maine et les écoles d'ingénieurs (ENSIM, ESIEA) apportent une demande étudiante stable d'environ 10 000 étudiants, concentrée près du campus de Ruaudin et du centre-ville.",
      "Les prix manceaux ont très peu bougé depuis 2020, ce qui a permis aux rendements de rester élevés pendant que d'autres villes voyaient les leurs se comprimer par la hausse des prix. En 2026, un T2 de 40 m² bien placé s'achète autour de 75 000 à 95 000 € et se loue 480 à 550 €/mois. La stratégie la plus efficace reste le T2/T3 dans les quartiers proches de la gare TGV (Gare-Pré, Saint-Benoît) pour capter la clientèle de pendulaires, ou près du campus universitaire pour la clientèle étudiante — deux profils de locataires distincts à ne pas mélanger dans le choix d'un bien.",
    ],
    biensPerformants: [
      { type: "T2 proche gare TGV", detail: "Cible les actifs travaillant à Paris, loyers stables, forte demande de mobilité." },
      { type: "Studio étudiant campus", detail: "10 000 étudiants (Université du Maine, ENSIM), demande concentrée sur septembre." },
      { type: "T3 familial quartiers résidentiels", detail: "Faible turnover, profil familial stable, entretien limité." },
    ],
    quartiers: [
      { nom: "Gare-Pré / Saint-Benoît", note: "Proximité immédiate de la gare TGV, cible pendulaires vers Paris, valorisation en hausse." },
      { nom: "Centre-ville / Cité Plantagenêt", note: "Cœur historique classé, cachet architectural, demande locative qualitative." },
      { nom: "Ruaudin / campus universitaire", note: "Proximité Université du Maine, forte densité étudiante, rendements élevés." },
      { nom: "Pontlieue", note: "Quartier résidentiel accessible, prix bas, demande familiale stable." },
    ],
    avantages: [
      "Rendement brut parmi les plus élevés des villes moyennes desservies par le TGV",
      "Liaison TGV Paris en 1h05 — bassin de locataires pendulaires solvables",
      "Prix d'entrée très accessibles, ticket d'investissement réduit",
    ],
    vigilances: [
      "Marché à la revente moins liquide que dans les grandes métropoles",
      "Dynamique économique locale plus modeste hors effet TGV",
      "Vacance plus sensible hors quartiers gare et campus — sélection d'emplacement déterminante",
    ],
    population: "145 000 habitants (agglomération 210 000)",
    villesProches: ["angers", "nantes"],
  },
  {
    slug: "mulhouse",
    name: "Mulhouse",
    region: "Grand Est",
    prixM2: 1600,
    loyerM2: 11,
    rendementBrut: 8.3,
    tensionLocative: "modérée",
    descriptionMarche:
      "Mulhouse cumule les prix les plus bas des grandes agglomérations françaises et une position frontalière avec la Suisse (Bâle à 30 minutes) qui génère une demande de travailleurs transfrontaliers à hauts revenus suisses mais logement français. Cette combinaison produit l'un des rendements bruts les plus élevés du pays.",
    analyses: [
      "La proximité de Bâle (30 minutes en voiture, ligne de tram-train directe) place Mulhouse dans une dynamique frontalière comparable à celle de Metz avec le Luxembourg : des travailleurs employés en Suisse, où les salaires sont 2 à 3 fois supérieurs à la moyenne française, choisissent de se loger côté français pour un coût de la vie très inférieur. Ce profil de locataire frontalier est solvable et recherché par les investisseurs avertis de la région. Mulhouse conserve par ailleurs un tissu industriel actif (Stellantis, industrie chimique) et une université (UHA, 10 000 étudiants) qui diversifient la base locative.",
      "Les prix mulhousiens comptent parmi les plus bas de toutes les villes de plus de 100 000 habitants en France, résultat d'une histoire industrielle marquée par les restructurations des décennies 1990-2000, dont le marché immobilier ne s'est jamais totalement remis en valeur malgré une économie locale aujourd'hui stabilisée. En 2026, un T2 rénové s'achète encore souvent sous 70 000 €, pour un loyer de 450 à 500 €/mois — un rapport prix/loyer rarement observé ailleurs en France métropolitaine. La contrepartie : une sélection de quartier rigoureuse est indispensable, l'écart de qualité entre les meilleurs secteurs et les zones les plus fragiles étant important.",
    ],
    biensPerformants: [
      { type: "T2/T3 pour frontaliers", detail: "Salariés en Suisse, revenus élevés, loyers payés rigoureusement." },
      { type: "Studio étudiant centre-ville", detail: "Université de Haute-Alsace, 10 000 étudiants, forte rotation." },
      { type: "T2 rénové quartiers résidentiels", detail: "Rapport prix d'achat/loyer parmi les meilleurs de France." },
    ],
    quartiers: [
      { nom: "Centre-ville historique", note: "Cachet architectural, bonne desserte tram, valeur locative la plus stable." },
      { nom: "Rebberg", note: "Quartier résidentiel prisé, villas et beaux appartements, familles aisées." },
      { nom: "Dornach / Bourtzwiller", note: "Prix très bas, rendements élevés, sélection de l'immeuble à faire avec rigueur." },
      { nom: "Illberg / secteur universitaire", note: "Proximité campus UHA, demande étudiante constante." },
    ],
    avantages: [
      "Prix au m² parmi les plus bas de toutes les grandes villes françaises",
      "Demande de travailleurs frontaliers suisses — profil de locataires à hauts revenus",
      "Rendements bruts souvent supérieurs à 8 % dans les secteurs bien choisis",
    ],
    vigilances: [
      "Hétérogénéité forte entre quartiers — écart de qualité important à anticiper",
      "Marché à la revente peu liquide hors secteurs premium",
      "Image de la ville encore marquée par son passé industriel, à intégrer dans la stratégie de sortie",
    ],
    population: "108 000 habitants (agglomération 275 000)",
    villesProches: ["strasbourg", "metz"],
  },
  {
    slug: "roubaix",
    name: "Roubaix",
    region: "Hauts-de-France",
    prixM2: 1400,
    loyerM2: 11,
    rendementBrut: 9.4,
    tensionLocative: "modérée",
    descriptionMarche:
      "Roubaix affiche les rendements bruts les plus élevés de ce comparatif, portés par des prix d'achat parmi les plus bas de France et son intégration à la métropole lilloise (15 minutes de Lille en métro). L'ancienne capitale textile connaît une rénovation urbaine active depuis plus d'une décennie, mais reste un marché qui exige une sélection de quartier particulièrement rigoureuse.",
    analyses: [
      "Roubaix fait partie de la Métropole Européenne de Lille et bénéficie d'une desserte en métro (ligne 2) qui la place à 15-20 minutes du centre de Lille et de ses pôles universitaires — une partie non négligeable des étudiants et jeunes actifs lillois, refoulés par des prix lillois en hausse, se logent désormais à Roubaix pour un budget très inférieur. La ville a également bénéficié de programmes de rénovation urbaine (ANRU) sur plus d'une décennie, avec une requalification progressive de plusieurs quartiers et un patrimoine industriel textile classé qui attire une frange de population en quête de grands volumes à prix accessible (lofts, anciennes usines réhabilitées).",
      "Les prix roubaisiens restent parmi les plus bas de toute la France pour une ville de cette taille intégrée à une grande métropole, avec des T2 accessibles sous 60 000 € dans plusieurs secteurs. Cette accessibilité explique des rendements bruts qui dépassent fréquemment 9 à 10 % dans les zones les mieux desservies. La contrepartie, qu'il serait malhonnête de passer sous silence : Roubaix reste une ville marquée par une pauvreté élevée et des poches de dégradation du bâti significatives, où le choix précis de la rue et de l'immeuble compte davantage que dans n'importe quelle autre ville de ce comparatif. Un investisseur qui ne connaît pas finement le terrain a tout intérêt à s'appuyer sur un professionnel local avant d'acheter.",
    ],
    biensPerformants: [
      { type: "T2 proche métro ligne 2", detail: "Cible étudiants et jeunes actifs travaillant à Lille, trajet 15-20 minutes." },
      { type: "Loft en ancienne usine textile réhabilitée", detail: "Grands volumes, patrimoine industriel, clientèle en quête d'atypique." },
      { type: "T3 familial quartiers rénovés ANRU", detail: "Secteurs requalifiés, bâti amélioré, demande familiale en hausse." },
    ],
    quartiers: [
      { nom: "Centre-ville / Grand'Place", note: "Secteur le plus valorisé, commerces, patrimoine Art déco, meilleure liquidité à la revente." },
      { nom: "Épeule / Pile", note: "Quartiers en rénovation ANRU, prix bas, potentiel mais sélection rigoureuse requise." },
      { nom: "Barbieux", note: "Quartier résidentiel le plus prisé, proche du parc Barbieux, familles aisées." },
      { nom: "Fresnoy-Mackellerie", note: "Proximité métro, en cours de requalification, rendements élevés à ce jour." },
    ],
    avantages: [
      "Rendements bruts parmi les plus élevés de toutes les grandes agglomérations françaises",
      "Intégration à la Métropole Européenne de Lille — métro direct vers les pôles universitaires et d'emploi",
      "Ticket d'entrée très accessible, effet de levier maximal pour un premier investissement",
    ],
    vigilances: [
      "Pauvreté et dégradation du bâti significatives dans plusieurs quartiers — sélection de rue indispensable",
      "Risque de vacance et d'impayés plus élevé que la moyenne nationale hors secteurs recherchés",
      "S'appuyer sur une connaissance fine du terrain ou un professionnel local avant l'achat, plus que dans toute autre ville de ce comparatif",
    ],
    population: "100 000 habitants (Métropole Européenne de Lille : 1,2 million)",
    villesProches: ["lille"],
  },
  {
    slug: "limoges",
    name: "Limoges",
    region: "Nouvelle-Aquitaine",
    prixM2: 1750,
    loyerM2: 10.5,
    rendementBrut: 7.2,
    tensionLocative: "modérée",
    descriptionMarche:
      "Limoges combine des prix d'achat très accessibles, une position centrale entre Paris, Toulouse et Bordeaux, et un marché locatif porté par ses 18 000 étudiants et son statut de préfecture régionale. Longtemps marquée par une croissance démographique atone, la ville affiche depuis quelques années une stabilisation qui rassure les investisseurs sur la durée.",
    analyses: [
      "Le marché limougeaud repose sur une base locative diversifiée : environ 18 000 étudiants (Université de Limoges, École Nationale Supérieure de Céramique Industrielle) concentrés autour du campus de Vanteaux et du centre-ville, complétés par les fonctionnaires et employés des administrations régionales et hospitalières (le CHU de Limoges est l'un des principaux employeurs de la région). Cette diversification protège la ville d'une dépendance excessive à un seul profil de locataire, contrairement à certaines villes universitaires plus petites.",
      "Après plusieurs décennies de croissance démographique quasi nulle qui ont limité la pression sur les prix, Limoges connaît depuis le début des années 2020 une légère reprise portée par l'exode urbain post-Covid et la recherche de villes moyennes à taille humaine. Les prix restent néanmoins très inférieurs à la moyenne nationale : un T2 de 45 m² bien situé s'achète autour de 80 000 à 100 000 € pour un loyer de 470 à 530 €/mois. La stratégie la plus solide consiste à cibler le centre-ville et les abords du campus de Vanteaux, où la demande locative est la plus constante, plutôt que les communes périphériques où la vacance peut être plus significative.",
    ],
    biensPerformants: [
      { type: "Studio étudiant campus Vanteaux", detail: "18 000 étudiants, Université de Limoges, ENSCI — demande stable en rentrée." },
      { type: "T2/T3 centre-ville", detail: "Cible fonctionnaires et personnel du CHU, faible turnover." },
      { type: "T3 familial quartiers résidentiels", detail: "Prix d'achat accessibles, demande familiale stable sur le temps long." },
    ],
    quartiers: [
      { nom: "Centre-ville / Cité", note: "Cœur historique, bonne desserte, demande locative la plus qualitative de la ville." },
      { nom: "Vanteaux", note: "Proximité campus universitaire, forte densité étudiante, rendements attractifs." },
      { nom: "Beaubreuil", note: "Prix très bas, quartier en rénovation urbaine, sélection à faire avec attention." },
      { nom: "Landouge / Beaune-les-Mines", note: "Secteurs résidentiels périphériques, prix accessibles, demande familiale." },
    ],
    avantages: [
      "Prix d'achat très accessibles pour une préfecture régionale",
      "Base locative diversifiée : étudiants, fonctionnaires, personnel hospitalier",
      "Position centrale (Paris, Toulouse, Bordeaux à 2-3h) qui limite l'isolement économique",
    ],
    vigilances: [
      "Dynamique démographique et économique plus modeste que les grandes métropoles régionales",
      "Marché à la revente moins liquide, délais de vente potentiellement plus longs",
      "Écarts significatifs entre quartiers centraux et périphériques — sélection d'emplacement déterminante",
    ],
    population: "130 000 habitants (agglomération 205 000)",
    villesProches: ["bordeaux", "toulouse"],
  },
];

export function getVilleBySlug(slug: string): VilleData | undefined {
  return VILLES_DATA.find((v) => v.slug === slug);
}

export function getAllVilleSlugs(): string[] {
  return VILLES_DATA.map((v) => v.slug);
}

// Maillage vers /prix-m2 pour la même ville. Paris/Lyon/Marseille n'ont pas de
// page ville unique côté DVF (les transactions sont enregistrées par
// arrondissement, ex. 69381-69389) : on pointe vers leur page département à la
// place. Metz/Strasbourg/Mulhouse (Alsace-Moselle) n'ont aucune page prix-m2 —
// le DVF ne couvre pas ces départements (régime de publicité foncière différent).
const PRIX_M2_TARGETS: Record<string, { kind: "ville" | "departement"; slug: string }> = {
  lyon: { kind: "departement", slug: "rhone" },
  marseille: { kind: "departement", slug: "bouches-du-rhone" },
  paris: { kind: "departement", slug: "paris" },
  bordeaux: { kind: "ville", slug: citySlug("Bordeaux", "33063") },
  toulouse: { kind: "ville", slug: citySlug("Toulouse", "31555") },
  rennes: { kind: "ville", slug: citySlug("Rennes", "35238") },
  nantes: { kind: "ville", slug: citySlug("Nantes", "44109") },
  lille: { kind: "ville", slug: citySlug("Lille", "59350") },
  montpellier: { kind: "ville", slug: citySlug("Montpellier", "34172") },
  grenoble: { kind: "ville", slug: citySlug("Grenoble", "38185") },
  angers: { kind: "ville", slug: citySlug("Angers", "49007") },
  "clermont-ferrand": { kind: "ville", slug: citySlug("Clermont-Ferrand", "63113") },
  nancy: { kind: "ville", slug: citySlug("Nancy", "54395") },
  nice: { kind: "ville", slug: citySlug("Nice", "06088") },
  "le-mans": { kind: "ville", slug: citySlug("Le Mans", "72181") },
  roubaix: { kind: "ville", slug: citySlug("Roubaix", "59512") },
  limoges: { kind: "ville", slug: citySlug("Limoges", "87085") },
};

export function getPrixM2Href(slug: string): string | null {
  const target = PRIX_M2_TARGETS[slug];
  if (!target) return null;
  return target.kind === "ville" ? `/prix-m2/${target.slug}` : `/prix-m2/departement/${target.slug}`;
}

// Code INSEE de la commune DVF correspondante, uniquement pour les villes
// mappées "ville" (pas Paris/Lyon/Marseille, découpées en arrondissements côté
// DVF) — sert à récupérer le Score lokt.fr (investment_score) pour le tableau
// comparatif de /rendement-locatif.
export function getVilleInseeCode(slug: string): string | null {
  const target = PRIX_M2_TARGETS[slug];
  if (!target || target.kind !== "ville") return null;
  return parseCitySlug(target.slug);
}
