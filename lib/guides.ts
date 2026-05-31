export type GuideCategory = "preparer" | "arrivee" | "gestion" | "depart";

export type GuideArticle = {
  slug: string;
  category: GuideCategory;
  title: string;
  shortTitle: string;
  description: string;
  updatedAt: string;
  intro: string;
  sections: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    note?: string;
  }>;
  checklist?: string[];
  sources: Array<{ label: string; href: string }>;
};

export const GUIDE_CATEGORIES: Array<{ key: GuideCategory; label: string; description: string }> = [
  { key: "preparer", label: "Préparer la mise en location", description: "Sécuriser le logement, le bail et la fiscalité avant l’annonce." },
  { key: "arrivee", label: "Accueillir le locataire", description: "Constituer un dossier propre et réussir la remise des clés." },
  { key: "gestion", label: "Pendant la location", description: "Gérer les loyers, les charges, les travaux et les échéances." },
  { key: "depart", label: "Organiser le départ", description: "Traiter le congé, l’état des lieux et le dépôt de garantie." },
];

export const GUIDES: GuideArticle[] = [
  {
    slug: "checklist-mise-en-location",
    category: "preparer",
    title: "Mettre un logement en location : la checklist complète du bailleur",
    shortTitle: "Checklist de mise en location",
    description: "Les contrôles, documents et décisions à traiter avant de publier l’annonce, signer le bail et remettre les clés.",
    updatedAt: "2026-05-31",
    intro:
      "Une mise en location réussie commence avant la première visite. L’objectif n’est pas d’empiler des documents : il faut vérifier que le logement peut réellement être loué, choisir le contrat adapté et conserver les preuves utiles dès le départ.",
    sections: [
      {
        title: "1. Vérifier que le logement peut être loué",
        paragraphs: [
          "Le bailleur doit délivrer un logement décent, ne présentant pas de risque manifeste pour la sécurité ou la santé du locataire. Avant toute annonce, vérifiez l’état des équipements essentiels, la ventilation, le chauffage, l’installation électrique, l’absence d’infiltration et la performance énergétique.",
          "Le DPE mérite une attention particulière : il ne sert pas uniquement à informer le candidat. La performance énergétique peut conditionner la possibilité même de louer le logement et l’évolution future du loyer.",
        ],
        bullets: ["Contrôler la décence et les équipements essentiels.", "Faire réaliser ou actualiser le DPE.", "Vérifier si un permis de louer existe dans la commune.", "Planifier les travaux avant les visites."],
      },
      {
        title: "2. Choisir le type de location",
        paragraphs: [
          "Le choix entre location vide, meublée ou bail mobilité change la durée du contrat, le dépôt de garantie, les meubles obligatoires et le traitement des charges. Il doit correspondre à l’usage réel du logement et au profil de locataire recherché.",
          "Pour une location meublée, préparez un inventaire précis et vérifiez que tous les éléments nécessaires à une occupation normale sont présents. La fiscalité relève alors des BIC et implique une déclaration de début d’activité.",
        ],
      },
      {
        title: "3. Constituer le dossier documentaire",
        paragraphs: ["Le dossier de diagnostic technique est annexé au bail. Préparez également le contrat, ses annexes, le règlement de copropriété utile au locataire, l’acte de cautionnement si nécessaire et vos informations de contact."],
        bullets: ["DDT complet et valide.", "Bail conforme au modèle applicable.", "Notice d’information et annexes utiles.", "Inventaire du mobilier pour un meublé.", "État des lieux d’entrée prêt avant la remise des clés."],
      },
      {
        title: "4. Fixer un loyer défendable",
        paragraphs: [
          "Le loyer initial est en principe libre, mais certaines communes sont soumises à des règles d’encadrement. Vérifiez la localisation du bien, les éventuelles règles de relocation et la clause de révision annuelle avant de publier un montant.",
          "Distinguez clairement le loyer hors charges, les provisions ou le forfait de charges et le dépôt de garantie. Cette séparation rend le bail lisible et évite les ambiguïtés lors des régularisations.",
        ],
      },
    ],
    checklist: ["Logement décent et assurable", "DPE et diagnostics valides", "Type de bail choisi", "Loyer et charges vérifiés", "Bail et annexes préparés", "État des lieux d’entrée planifié", "Dossier locataire vérifié"],
    sources: [
      { label: "Service-Public : obligations du propriétaire bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059" },
      { label: "ANIL : diagnostics obligatoires", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/diagnostics/" },
    ],
  },
  {
    slug: "dpe-diagnostics-location",
    category: "preparer",
    title: "DPE et diagnostics locatifs : comprendre le dossier à remettre au locataire",
    shortTitle: "DPE et diagnostics",
    description: "À quoi sert le DPE, quels diagnostics réunir et à quel moment les transmettre au locataire.",
    updatedAt: "2026-05-31",
    intro:
      "Le dossier de diagnostic technique, souvent appelé DDT, doit être traité très tôt. Plusieurs informations sont nécessaires dès l’annonce et le dossier complet doit être annexé au bail au moment de sa signature puis lors de son renouvellement.",
    sections: [
      {
        title: "Le rôle du DPE",
        paragraphs: [
          "Le diagnostic de performance énergétique estime la consommation d’énergie et les émissions de gaz à effet de serre du logement. Il attribue une classe allant de A à G et aide le candidat à anticiper la qualité énergétique du bien.",
          "Le DPE a aussi une portée opérationnelle : la réglementation énergétique des locations évolue progressivement. Un bailleur doit donc vérifier la validité du diagnostic et la situation exacte du logement avant toute nouvelle mise en location.",
        ],
        note: "Ne raisonnez pas uniquement à partir d’un ancien DPE archivé : vérifiez sa date de validité et les règles en vigueur au moment de signer.",
      },
      {
        title: "Les éléments courants du DDT",
        bullets: [
          "DPE valide.",
          "Constat de risque d’exposition au plomb pour les logements concernés.",
          "État de l’installation intérieure d’électricité si elle a plus de 15 ans.",
          "État de l’installation intérieure de gaz si elle a plus de 15 ans.",
          "État des risques lorsque le logement est situé dans une zone concernée.",
          "Information sur le bruit lorsque le logement est situé dans une zone d’exposition au bruit des aérodromes.",
        ],
        paragraphs: ["Le diagnostic amiante des parties privatives répond à un régime particulier : lorsqu’il est applicable, conservez-le disponible pour le locataire. Les situations varient selon l’âge, l’emplacement et les caractéristiques du logement."],
      },
      {
        title: "Le bon calendrier",
        paragraphs: [
          "Faites établir les diagnostics avant de publier l’annonce. Vous pourrez ainsi communiquer les informations requises, identifier d’éventuels travaux et éviter une signature retardée par un document manquant.",
          "Archivez le dossier remis avec le bail et ajoutez un rappel avant l’échéance de chaque diagnostic. Pour un portefeuille de plusieurs biens, cette discipline évite de découvrir une expiration au moment d’un changement de locataire.",
        ],
      },
    ],
    checklist: ["DPE valide contrôlé", "Ancienneté des installations vérifiée", "État des risques actualisé", "DDT annexé au bail", "Copies archivées par logement", "Rappels d’expiration créés"],
    sources: [
      { label: "Service-Public : diagnostics à fournir en location", href: "https://www.service-public.fr/particuliers/vosdroits/F33463" },
      { label: "ANIL : dossier de diagnostic technique", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/diagnostics/" },
    ],
  },
  {
    slug: "lmnp-checklist-location-meublee",
    category: "preparer",
    title: "LMNP : la checklist pratique avant de louer un logement meublé",
    shortTitle: "Checklist LMNP",
    description: "Mobilier, inventaire, début d’activité, SIRET et choix fiscal : les points à traiter pour une location meublée sérieuse.",
    updatedAt: "2026-05-31",
    intro:
      "Louer en meublé ne consiste pas à ajouter quelques meubles à un logement vide. Le bien doit permettre une occupation normale, l’inventaire doit être précis et l’activité doit être déclarée. La qualification LMNP a aussi des conséquences fiscales concrètes.",
    sections: [
      {
        title: "Équiper réellement le logement",
        paragraphs: ["Un logement meublé doit comporter les éléments indispensables à la vie quotidienne. Vérifiez chaque pièce et photographiez les équipements remis au locataire. Un inventaire daté, joint au bail et cohérent avec l’état des lieux protège les deux parties."],
        bullets: ["Literie avec couette ou couverture.", "Occultation des fenêtres dans les pièces destinées au sommeil.", "Plaques de cuisson et four ou four à micro-ondes.", "Réfrigérateur avec compartiment permettant de conserver des aliments congelés.", "Vaisselle, ustensiles de cuisine, table, sièges et rangements.", "Luminaires et matériel d’entretien adapté."],
      },
      {
        title: "Déclarer le début d’activité",
        paragraphs: [
          "La location meublée relève des bénéfices industriels et commerciaux. Le début d’activité doit être déclaré sur le guichet des formalités des entreprises dans les quinze jours suivant le premier jour de location. Cette formalité permet notamment d’obtenir un numéro SIRET.",
          "La première année, vérifiez également vos obligations relatives à la CFE. Certaines situations bénéficient d’exonérations, mais il ne faut pas présumer qu’elles s’appliquent automatiquement.",
        ],
      },
      {
        title: "Choisir entre micro-BIC et réel",
        paragraphs: [
          "Le micro-BIC applique un abattement forfaitaire. Le régime réel permet de tenir compte des charges déductibles et, selon les règles applicables, de l’amortissement. Le bon choix dépend du bien, du financement, des charges et de votre situation.",
          "Le réel suppose une comptabilité sérieuse. Avant de choisir, simulez les deux options et validez votre situation avec un expert-comptable si l’enjeu est significatif.",
        ],
        note: "La fiscalité évolue. Revérifiez les seuils et règles de l’année concernée sur impots.gouv.fr avant toute déclaration.",
      },
    ],
    checklist: ["Mobilier obligatoire présent", "Inventaire détaillé préparé", "Bail meublé adapté", "Début d’activité déclaré dans les délais", "SIRET archivé", "Micro-BIC et réel comparés", "CFE vérifiée"],
    sources: [
      { label: "Impots.gouv.fr : location meublée", href: "https://www.impots.gouv.fr/particulier/location-meublee" },
      { label: "Impots.gouv.fr : déclarer un début d’activité et obtenir un SIRET", href: "https://www.impots.gouv.fr/particulier/questions/si-je-mets-en-location-un-meuble-dois-je-minscrire-au-greffe-du-tribunal-de" },
    ],
  },
  {
    slug: "choisir-bail-vide-meuble-mobilite",
    category: "preparer",
    title: "Location vide, meublée ou bail mobilité : choisir le contrat adapté",
    shortTitle: "Choisir le bon bail",
    description: "Comparer les usages et les contraintes avant de sélectionner le contrat de location.",
    updatedAt: "2026-05-31",
    intro:
      "Le bon bail n’est pas celui qui semble le plus souple : c’est celui qui correspond à la réalité du logement et à la situation du locataire. Une qualification artificielle fragilise la relation locative.",
    sections: [
      {
        title: "Location vide",
        paragraphs: ["La location vide convient à un logement non équipé comme un meublé et destiné à la résidence principale du locataire. Elle offre un cadre stable et suppose de préparer un bail conforme au modèle réglementaire, avec ses informations et annexes."],
      },
      {
        title: "Location meublée",
        paragraphs: ["La location meublée exige un équipement suffisant et un inventaire. Elle entraîne aussi des obligations fiscales spécifiques : les recettes relèvent des BIC et le début d’activité doit être déclaré."],
      },
      {
        title: "Bail mobilité",
        paragraphs: ["Le bail mobilité répond à des situations temporaires encadrées. Il ne faut pas l’utiliser comme une version courte universelle du bail d’habitation. Vérifiez l’éligibilité du locataire et les règles propres à ce contrat avant signature."],
      },
      {
        title: "Décider sans improviser",
        bullets: ["Identifier l’usage réel du logement.", "Vérifier le profil et l’éligibilité du locataire.", "Comparer durée, dépôt de garantie et traitement des charges.", "Préparer le bon modèle de contrat et ses annexes.", "Ne pas confondre location meublée longue durée et meublé de tourisme."],
      },
    ],
    sources: [
      { label: "Service-Public : rédaction du bail d’habitation vide", href: "https://www.service-public.fr/particuliers/vosdroits/F35109/0_0?idFicheParent=F920" },
      { label: "Impots.gouv.fr : les locations meublées", href: "https://www.impots.gouv.fr/particulier/les-locations-meublees" },
    ],
  },
  {
    slug: "arrivee-locataire-remise-cles",
    category: "arrivee",
    title: "Arrivée du locataire : réussir la remise des clés et le démarrage du bail",
    shortTitle: "Arrivée du locataire",
    description: "Le déroulé concret de la signature à l’état des lieux d’entrée, avec les preuves à conserver.",
    updatedAt: "2026-05-31",
    intro:
      "L’entrée dans les lieux est un moment court mais décisif. Prenez le temps de remettre un dossier complet, de décrire précisément le logement et de relever les informations qui seront indispensables au départ.",
    sections: [
      {
        title: "Avant le rendez-vous",
        bullets: ["Faire signer le bail et ses annexes.", "Vérifier l’assurance habitation lorsque celle-ci est requise.", "Préparer le nombre exact de clés, badges et télécommandes.", "Préparer les relevés de compteurs et l’inventaire si le logement est meublé.", "Conserver les justificatifs des sommes versées."],
      },
      {
        title: "Réaliser un état des lieux précis",
        paragraphs: [
          "L’état des lieux décrit le logement et ses équipements au moment de la remise des clés. Évitez les formulations vagues. Décrivez les défauts, leur emplacement et leur importance ; ajoutez des photos lorsque cela améliore la preuve.",
          "Passez pièce par pièce avec le locataire, dans de bonnes conditions d’éclairage. Relevez les compteurs, le nombre de clés et l’état des équipements. Pour un meublé, rapprochez l’état des lieux de l’inventaire du mobilier.",
        ],
      },
      {
        title: "Après la remise des clés",
        paragraphs: ["Remettez un exemplaire signé au locataire et archivez le vôtre avec le bail. Créez vos rappels de gestion : date de paiement, révision éventuelle du loyer, régularisation des charges, échéances d’assurance et diagnostics."],
      },
    ],
    checklist: ["Bail signé", "Annexes remises", "Assurance vérifiée", "État des lieux détaillé signé", "Compteurs relevés", "Clés et badges comptés", "Inventaire meublé signé", "Rappels de gestion créés"],
    sources: [
      { label: "ANIL : état des lieux d’entrée et de sortie", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/etat-des-lieux/" },
      { label: "Service-Public : obligations du propriétaire bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059" },
    ],
  },
  {
    slug: "loyers-quittances-charges-suivi",
    category: "gestion",
    title: "Loyers, quittances et charges : organiser un suivi locatif propre",
    shortTitle: "Loyers, quittances et charges",
    description: "Mettre en place une routine mensuelle fiable et préparer la régularisation des charges.",
    updatedAt: "2026-05-31",
    intro:
      "Une gestion locative fiable repose sur une routine simple : rapprocher le paiement attendu du paiement reçu, traiter rapidement les écarts et archiver les documents. Cette discipline devient précieuse au premier impayé ou lors du départ du locataire.",
    sections: [
      {
        title: "La routine mensuelle",
        bullets: ["Vérifier le loyer et les charges attendus.", "Confirmer l’encaissement réel sur le compte bancaire.", "Distinguer paiement complet, partiel et absence de paiement.", "Émettre la quittance lorsque les conditions sont réunies.", "Archiver les échanges et justificatifs."],
      },
      {
        title: "Quittance et reçu",
        paragraphs: ["La quittance atteste le paiement complet du loyer et des charges pour une période donnée. Ne la confondez pas avec un simple reçu lorsque le règlement est partiel. Conservez l’historique par bail et par mois."],
      },
      {
        title: "Charges récupérables",
        paragraphs: [
          "Les charges récupérables sont des dépenses initialement payées par le bailleur mais pouvant être remboursées par le locataire dans le cadre prévu. Pour un logement vide avec provisions, elles font l’objet d’une régularisation annuelle comparant les provisions versées aux dépenses réelles justifiées.",
          "Pour un meublé, le bail peut prévoir un forfait ou des provisions avec régularisation. Un forfait ne fonctionne pas comme une avance : il ne donne pas lieu à une régularisation ultérieure.",
        ],
      },
    ],
    checklist: ["Encaissements rapprochés chaque mois", "Paiements partiels isolés", "Quittances archivées", "Charges récupérables distinguées", "Justificatifs conservés", "Régularisation annuelle planifiée"],
    sources: [
      { label: "Service-Public : paiement du loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1214" },
      { label: "Service-Public : charges locatives récupérables", href: "https://www.service-public.fr/particuliers/vosdroits/F947" },
    ],
  },
  {
    slug: "travaux-reparations-bailleur-locataire",
    category: "gestion",
    title: "Travaux et réparations : qui paie entre le bailleur et le locataire ?",
    shortTitle: "Travaux et réparations",
    description: "Distinguer entretien courant, réparations locatives, vétusté et travaux à la charge du propriétaire.",
    updatedAt: "2026-05-31",
    intro:
      "Les litiges naissent souvent d’un mauvais diagnostic : petite réparation, dégradation, vétusté ou équipement défaillant. Avant de répondre, documentez le problème et recherchez sa cause.",
    sections: [
      {
        title: "Ce qui relève généralement du locataire",
        paragraphs: ["Le locataire prend en charge l’entretien courant et les petites réparations liées à l’usage normal du logement. Cela inclut par exemple certaines menues réparations, l’entretien courant des équipements et le maintien de la propreté."],
      },
      {
        title: "Ce qui relève généralement du bailleur",
        paragraphs: ["Le bailleur prend en charge les travaux qui ne sont pas des réparations locatives, notamment ceux rendus nécessaires par la vétusté, une malfaçon ou un équipement qui doit être remplacé. Une fuite liée à la vétusté d’une canalisation ne se traite pas comme un joint usé par l’usage courant."],
      },
      {
        title: "Le bon réflexe en cas de signalement",
        bullets: ["Demander une description et des photos.", "Qualifier l’urgence et les risques.", "Conserver les échanges dans un canal traçable.", "Faire intervenir un professionnel si la cause n’est pas évidente.", "Archiver devis, facture et conclusion technique.", "Mettre à jour l’historique du logement."],
        note: "Pour un cas litigieux ou coûteux, prenez conseil auprès de votre ADIL ou d’un professionnel du droit.",
      },
    ],
    sources: [
      { label: "Service-Public : réparations locatives", href: "https://www.service-public.fr/particuliers/vosdroits/F31697" },
      { label: "Service-Public : travaux à la charge du bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/F31699" },
    ],
  },
  {
    slug: "revision-loyer-irl",
    category: "gestion",
    title: "Révision du loyer : appliquer l’IRL sans improviser",
    shortTitle: "Révision du loyer et IRL",
    description: "Vérifier la clause, la date et l’indice avant de calculer une révision annuelle.",
    updatedAt: "2026-05-31",
    intro:
      "Une hausse de loyer ne se décide pas au jugé. La révision annuelle doit être prévue par le bail et calculée selon les règles applicables. Les restrictions liées à la performance énergétique du logement doivent également être vérifiées.",
    sections: [
      {
        title: "Commencer par lire le bail",
        paragraphs: ["Vérifiez l’existence d’une clause de révision, la date prévue et l’indice de référence retenu. Sans clause adaptée, n’appliquez pas mécaniquement une hausse annuelle."],
      },
      {
        title: "Calculer et documenter",
        paragraphs: ["Conservez le loyer avant révision, l’indice de référence de départ, le nouvel indice, la date d’effet et le calcul détaillé. Informez le locataire de façon claire et archivez le message avec le bail."],
      },
      {
        title: "Contrôler les restrictions",
        paragraphs: ["Avant toute révision, vérifiez la situation énergétique du logement et les règles locales applicables. Les logements situés dans certaines zones ou présentant certaines performances peuvent être soumis à des restrictions particulières."],
      },
    ],
    checklist: ["Clause de révision relue", "Date d’effet vérifiée", "Indice applicable contrôlé", "DPE et restrictions vérifiés", "Calcul archivé", "Information envoyée au locataire"],
    sources: [{ label: "Service-Public : paiement et révision du loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1214" }],
  },
  {
    slug: "depart-locataire-etat-des-lieux-sortie",
    category: "depart",
    title: "Départ du locataire : du préavis à l’état des lieux de sortie",
    shortTitle: "Départ du locataire",
    description: "Organiser le congé, le dernier mois, la visite de sortie et la restitution des clés.",
    updatedAt: "2026-05-31",
    intro:
      "Un départ bien géré commence dès la réception du congé. L’objectif est de fixer les dates, préparer la comparaison avec l’entrée et éviter que les décisions financières soient prises dans la précipitation.",
    sections: [
      {
        title: "À la réception du congé",
        bullets: ["Archiver le congé et sa date de réception.", "Vérifier le délai de préavis applicable.", "Confirmer par écrit la date cible de fin de bail.", "Planifier l’état des lieux de sortie et la restitution des clés.", "Préparer le calcul du dernier loyer au prorata si nécessaire."],
      },
      {
        title: "Préparer l’état des lieux de sortie",
        paragraphs: ["Reprenez l’état des lieux d’entrée, les photographies et l’inventaire éventuel. Faites la visite lorsque le logement est vidé et dans de bonnes conditions d’éclairage. Relevez à nouveau les compteurs et le nombre de clés restituées."],
      },
      {
        title: "Comparer avec méthode",
        paragraphs: ["Distinguez l’usure normale, la vétusté et les dégradations imputables au locataire. Une retenue ne doit pas reposer sur une impression générale : documentez les écarts et conservez les justificatifs utiles."],
      },
      {
        title: "Préparer la remise en location",
        paragraphs: ["Après la sortie, planifiez les réparations, vérifiez les diagnostics et mettez à jour l’annonce. Si le logement a évolué, actualisez son inventaire et ses informations financières avant d’accueillir un nouveau locataire."],
      },
    ],
    checklist: ["Congé archivé", "Préavis vérifié", "Dernier loyer calculé", "État des lieux d’entrée ressorti", "Sortie réalisée logement vidé", "Clés et compteurs relevés", "Retenues justifiées", "Remise en location planifiée"],
    sources: [
      { label: "Service-Public : congé donné par le locataire", href: "https://www.service-public.fr/particuliers/vosdroits/F1168" },
      { label: "ANIL : état des lieux", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/etat-des-lieux/" },
    ],
  },
  {
    slug: "depot-garantie-restitution-retenues",
    category: "depart",
    title: "Dépôt de garantie : restituer, justifier et éviter les litiges",
    shortTitle: "Dépôt de garantie",
    description: "Comprendre le rôle du dépôt de garantie et documenter correctement les retenues éventuelles.",
    updatedAt: "2026-05-31",
    intro:
      "Le dépôt de garantie n’est ni un dernier loyer ni une réserve librement utilisable. Il sert à couvrir certains manquements du locataire, à condition de traiter les retenues avec méthode et justificatifs.",
    sections: [
      {
        title: "Dès la signature du bail",
        paragraphs: ["Inscrivez clairement le montant dans le bail et conservez la preuve du versement. Les règles diffèrent selon le type de contrat : vérifiez la situation exacte du logement avant de réclamer une somme."],
      },
      {
        title: "Au moment du départ",
        paragraphs: ["Comparez les états des lieux d’entrée et de sortie. Isolez les loyers ou charges restant dus, les réparations locatives et les écarts documentés. La vétusté et les travaux relevant du bailleur ne doivent pas être imputés au locataire."],
      },
      {
        title: "Justifier et clôturer",
        paragraphs: ["Conservez les pièces qui expliquent chaque retenue : états des lieux, photographies, factures, devis et échanges. Adressez au locataire un décompte lisible et archivez le règlement final avec le dossier du bail."],
        note: "Les délais de restitution et les conditions de retenue dépendent de la situation. Vérifiez la fiche officielle avant de clôturer le dossier.",
      },
    ],
    checklist: ["Montant conforme au type de bail", "Versement tracé", "Entrée et sortie comparées", "Vétusté distinguée des dégradations", "Retenues documentées", "Décompte transmis", "Clôture archivée"],
    sources: [{ label: "Service-Public : dépôt de garantie", href: "https://www.service-public.fr/particuliers/vosdroits/F31269" }],
  },
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) || null;
}

export function getGuidesByCategory(category: GuideCategory) {
  return GUIDES.filter((guide) => guide.category === category);
}
