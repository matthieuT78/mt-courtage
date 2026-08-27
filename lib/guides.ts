export type GuideCategory = "preparer" | "arrivee" | "gestion" | "depart" | "fiscal";

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
  faq?: Array<{ q: string; a: string }>;
};

export const GUIDE_CATEGORIES: Array<{ key: GuideCategory; label: string; description: string }> = [
  { key: "preparer", label: "Préparer la mise en location", description: "Sécuriser le logement, le bail et la fiscalité avant l'annonce." },
  { key: "arrivee", label: "Accueillir le locataire", description: "Constituer un dossier propre et réussir la remise des clés." },
  { key: "gestion", label: "Pendant la location", description: "Gérer les loyers, les charges, les travaux et les échéances." },
  { key: "depart", label: "Organiser le départ", description: "Traiter le congé, l'état des lieux et le dépôt de garantie." },
  { key: "fiscal", label: "Fiscalité et déclaration", description: "Choisir son régime, déclarer ses revenus locatifs et éviter les pénalités." },
];

export const GUIDES: GuideArticle[] = [
  {
    slug: "checklist-mise-en-location",
    category: "preparer",
    title: "Mise en location 2026 : la checklist complète du bailleur",
    shortTitle: "Checklist de mise en location",
    description: "Les contrôles, documents et décisions à traiter avant de publier l'annonce, signer le bail et remettre les clés.",
    updatedAt: "2026-06-28",
    intro:
      "Une mise en location réussie commence avant la première visite. L'objectif n'est pas d'empiler des documents : il faut vérifier que le logement peut réellement être loué, choisir le contrat adapté, fixer un loyer défendable et conserver les preuves utiles dès le départ. Un oubli à cette étape peut bloquer la signature, fragiliser le bail ou créer un litige des mois plus tard.",
    sections: [
      {
        title: "1. Vérifier que le logement peut être loué",
        paragraphs: [
          "Le bailleur est légalement tenu de délivrer un logement décent, sans risque manifeste pour la sécurité ou la santé du locataire. La décence repose sur plusieurs critères cumulatifs : surface minimale (9 m² et 2,20 m de hauteur sous plafond), absence d'humidité excessive, ventilation fonctionnelle, installation électrique sécurisée, chauffage adapté et équipements sanitaires en état de marche.",
          "Le DPE conditionne désormais la possibilité même de louer. Depuis le 1er janvier 2025, les logements classés G (consommation supérieure à 450 kWh/m²/an) ne peuvent plus faire l'objet de nouveaux baux. Les logements F font l'objet d'un gel du loyer à la relocation depuis 2022 : le loyer du nouveau locataire ne peut pas dépasser celui du précédent. Vérifiez la classe DPE avant toute démarche.",
          "Certaines communes imposent un permis de louer avant toute mise en location : renseignez-vous auprès de la mairie ou de la communauté de communes. L'absence de ce permis peut entraîner une amende et la nullité des loyers perçus.",
        ],
        bullets: [
          "Surface habitable conforme (minimum 9 m², hauteur sous plafond 2,20 m).",
          "Chauffage, eau chaude et équipements sanitaires fonctionnels.",
          "Installation électrique et gaz sans danger manifeste.",
          "DPE valide : classe E ou mieux pour une location sans contrainte.",
          "Vérification de l'existence d'un permis de louer dans la commune.",
          "Absence de risque d'humidité, de moisissures ou d'infiltration visible.",
        ],
      },
      {
        title: "2. Constituer le dossier de diagnostic technique (DDT)",
        paragraphs: [
          "Le dossier de diagnostic technique doit être annexé au bail au moment de la signature. Certains diagnostics doivent également figurer dans l'annonce immobilière. Un DDT incomplet ou périmé peut être invoqué par le locataire pour obtenir une réduction de loyer ou engager la responsabilité du bailleur.",
          "Les diagnostics obligatoires varient selon l'ancienneté du logement, sa localisation et ses équipements. Pour un appartement construit avant 1949 avec installation électrique de plus de 15 ans situé en zone à risque sismique, le dossier peut comprendre 5 à 6 documents distincts. Faites établir ou actualiser l'ensemble avant de publier l'annonce.",
          "La validité de chaque diagnostic est limitée dans le temps : le DPE est valable 10 ans, mais un DPE réalisé avant juillet 2021 est caduc depuis le 1er janvier 2023. L'état des risques doit être actualisé tous les 6 mois. Vérifiez les dates d'expiration de chaque document.",
        ],
        bullets: [
          "DPE valide (10 ans, antérieur à 2021 : à renouveler).",
          "CREP (plomb) si logement construit avant 1949.",
          "Diagnostic gaz si installation intérieure de plus de 15 ans.",
          "Diagnostic électricité si installation intérieure de plus de 15 ans.",
          "État des risques et pollutions (à actualiser tous les 6 mois).",
          "Diagnostic bruit si le logement est en zone d'exposition au bruit d'aérodrome.",
          "Diagnostic amiante des parties privatives (si construction avant 1997, à conserver disponible).",
        ],
      },
      {
        title: "3. Choisir le type de location et le bail adapté",
        paragraphs: [
          "Le choix entre location vide, meublée ou bail mobilité n'est pas anodin. Il détermine la durée minimale du contrat, le montant du dépôt de garantie, les meubles obligatoires, le préavis applicable et le régime fiscal. Un logement loué \"meublé\" sans mobilier conforme à la liste réglementaire peut être requalifié en location vide par un tribunal — avec toutes les conséquences que cela implique sur le bail et la fiscalité.",
          "En location vide, le bail dure 3 ans minimum, le dépôt de garantie est plafonné à 1 mois de loyer hors charges, et le préavis du locataire est de 3 mois (réduit à 1 mois en zone tendue). En location meublée, le bail dure 1 an (ou 9 mois pour un bail étudiant), le dépôt peut aller jusqu'à 2 mois de loyer hors charges, et le préavis du locataire est de 1 mois quelle que soit la zone.",
          "Pour une location meublée, préparez un inventaire détaillé et photographié du mobilier remis. Le décret du 31 juillet 2015 liste 11 catégories d'équipements obligatoires. L'absence d'un élément peut fragiliser la qualification meublée — et donc la fiscalité BIC qui en découle.",
        ],
        bullets: [
          "Location vide : bail 3 ans, dépôt de garantie 1 mois HC, préavis locataire 3 mois (1 mois zone tendue).",
          "Location meublée : bail 1 an, dépôt de garantie 2 mois HC, préavis locataire 1 mois.",
          "Bail mobilité : 1 à 10 mois, sans dépôt de garantie, pour profils en formation ou mission pro.",
          "Bail étudiant : 9 mois non renouvelables, libère le logement en juin.",
        ],
        note: "Un bail meublé implique une déclaration de début d'activité LMNP sur le guichet formalités des entreprises dans les 15 jours suivant le premier jour de location.",
      },
      {
        title: "4. Fixer un loyer défendable",
        paragraphs: [
          "Le loyer initial est en principe libre, mais des règles encadrent certaines situations. Dans les communes soumises à l'encadrement des loyers (Paris, Lyon, Bordeaux, Lille, Montpellier et d'autres communes en zone tendue), le loyer est plafonné par un loyer de référence majoré fixé par arrêté préfectoral. Dépasser ce plafond expose le bailleur à une mise en conformité forcée et au remboursement des sommes perçues en trop.",
          "Lors d'une relocation (changement de locataire), des règles spécifiques s'appliquent en zone tendue : le loyer ne peut être réévalué que dans des cas précis (logement vacant depuis plus de 18 mois, travaux d'amélioration significatifs, loyer manifestement sous-évalué par rapport au marché). Vérifiez la situation avant de fixer le montant.",
          "Distinguez clairement le loyer hors charges, les provisions sur charges (avec régularisation annuelle) ou le forfait charges, et le dépôt de garantie. Ces montants doivent figurer séparément dans le bail. Un loyer \"charges comprises\" sans distinction rend la régularisation impossible.",
        ],
        bullets: [
          "Vérifier si le logement est en zone d'encadrement des loyers.",
          "Comparer avec les loyers de référence officiels (DRIHL pour Paris, données préfectorales pour les autres communes).",
          "Indiquer séparément loyer HC et provisions sur charges dans le bail.",
          "Prévoir une clause de révision annuelle indexée sur l'IRL.",
          "Vérifier les règles de relocation en zone tendue avant de modifier le loyer.",
        ],
      },
      {
        title: "5. Sélectionner le locataire dans les règles",
        paragraphs: [
          "La sélection du locataire est encadrée par la loi du 22 juin 1989 et la loi Alur. Le bailleur ne peut exiger que des pièces listées dans le décret du 5 novembre 2015 : pièce d'identité, justificatifs de revenus (bulletins de salaire, avis d'imposition, contrat de travail), justificatif de domicile actuel. Demander un RIB, un extrait de casier judiciaire, un état de santé ou une photo est interdit.",
          "Vérifiez la cohérence et la régularité des documents fournis sans en demander davantage. Si les revenus vous semblent insuffisants, vous pouvez exiger une caution solidaire (garant) — mais pas cumuler caution solidaire et garantie loyers impayés (GLI) sauf si le locataire est étudiant ou apprenti. L'alternative gratuite Visale (Action Logement) couvre certains profils précaires.",
          "La discrimination est punie par la loi : refuser un dossier au motif de l'origine, du nom, de l'apparence physique, du handicap ou de la situation familiale expose à une sanction pénale. Basez votre décision uniquement sur la solvabilité et la fiabilité du dossier.",
        ],
        bullets: [
          "Pièces autorisées : identité, bulletins de salaire (3 derniers), contrat de travail, avis d'imposition, justificatif de domicile.",
          "Revenus recommandés : 3x le loyer charges comprises (critère d'usage, non obligatoire légalement).",
          "Garant possible : personnes physiques ou morales (Action Logement, Visale).",
          "Interdit de demander : RIB, photo, casier judiciaire, état de santé, relevé de compte.",
          "GLI et caution solidaire : non cumulables, sauf locataire étudiant ou apprenti.",
        ],
        note: "Conservez les dossiers refusés 1 an minimum en cas de contestation. Notez par écrit la raison objective du refus.",
      },
      {
        title: "6. Préparer le bail et ses annexes",
        paragraphs: [
          "Le bail doit être rédigé conformément aux modèles types définis par décret (arrêté du 29 mai 2015 pour les baux vides et meublés). Certaines clauses sont réputées non écrites même si elles figurent dans le contrat : interdiction d'héberger des proches, pénalité automatique sans mise en demeure préalable, obligation de souscrire une assurance auprès d'un assureur désigné par le bailleur.",
          "Les annexes obligatoires varient selon le type de bail : notice d'information sur les droits et obligations, DDT complet, état des lieux d'entrée (à réaliser le jour de la remise des clés), extrait du règlement de copropriété si applicable, inventaire pour un meublé, acte de cautionnement si un garant est prévu.",
          "L'acte de cautionnement doit contenir une mention manuscrite du garant reprenant le montant du loyer et ses obligations. Depuis la loi Alur, la caution à durée indéterminée doit prévoir un délai de résiliation. Vérifiez que l'acte est conforme avant la signature du bail.",
        ],
        bullets: [
          "Bail conforme au modèle réglementaire applicable (vide ou meublé).",
          "DDT complet annexé.",
          "Notice d'information sur les droits et obligations des parties.",
          "État des lieux d'entrée : à réaliser le jour de la remise des clés, pas avant.",
          "Inventaire pour un meublé : daté, signé, avec photos.",
          "Acte de cautionnement : mentions manuscrites du garant conformes.",
          "Extrait du règlement de copropriété (parties communes et règles de vie).",
        ],
      },
      {
        title: "7. Préparer la gestion dès le premier jour",
        paragraphs: [
          "La mise en location est un point de départ, pas un événement isolé. Dès la signature, des actions récurrentes se mettent en place : encaisser le loyer, délivrer la quittance (obligatoire si le locataire la demande), suivre les charges, anticiper la révision IRL, gérer les signalements de travaux et préparer la régularisation annuelle des charges.",
          "Créez un dossier par logement regroupant le bail, les annexes, les diagnostics, les échanges significatifs avec le locataire, les factures de travaux et les quittances. Cette organisation vous fait gagner du temps lors d'un départ, d'un litige ou d'une vérification fiscale.",
          "Notez dès le départ les échéances clés : date anniversaire pour la révision IRL, date d'expiration de chaque diagnostic, date de régularisation des charges (généralement dans les 6 mois suivant la clôture de l'exercice de copropriété), date de renouvellement de l'assurance PNO.",
        ],
        bullets: [
          "Dossier par logement créé avec tous les documents signés.",
          "Date de paiement du loyer fixée (et communiquée au locataire).",
          "Rappel de révision IRL à la date anniversaire du bail.",
          "Rappel d'expiration de chaque diagnostic (DPE, état des risques...).",
          "Canal de communication avec le locataire défini (email traçable).",
          "Modèle de quittance préparé.",
        ],
      },
    ],
    checklist: [
      "Logement décent, DPE classe E ou mieux",
      "DDT complet et valide",
      "Type de bail choisi et adapté",
      "Loyer conforme à l'encadrement éventuel",
      "Dossier locataire vérifié dans les règles",
      "Bail conforme au modèle réglementaire",
      "Annexes et acte de caution préparés",
      "État des lieux d'entrée prévu le jour J",
      "Dossier de gestion créé",
      "Échéances notées (IRL, diagnostics, charges)",
    ],
    faq: [
      { q: "Combien de temps faut-il pour mettre un logement en location dans les règles ?", a: "Comptez généralement 2 à 4 semaines entre la décision de louer et la remise des clés : le temps de réunir le dossier de diagnostic technique (DPE, éventuellement plomb, gaz, électricité), de choisir le type de bail adapté, de fixer un loyer défendable et de sélectionner un locataire. Les diagnostics doivent être prêts avant même de publier l'annonce, pas au moment de la signature." },
      { q: "Peut-on rédiger son propre contrat de bail plutôt que d'utiliser un modèle type ?", a: "Les baux d'habitation vide et meublée sont soumis à des modèles types réglementaires (décrets fixant les clauses obligatoires). Un contrat rédigé librement qui omet une mention obligatoire ou intègre une clause abusive peut être partiellement invalidé. Il est recommandé de partir d'un modèle conforme plutôt que de rédiger de zéro." },
      { q: "Que se passe-t-il si un diagnostic n'est pas prêt au moment de signer le bail ?", a: "Le bail reste valable, mais le bailleur engage sa responsabilité en cas de sinistre ou de litige lié à l'absence du document. Certains diagnostics (DPE notamment) doivent en principe figurer dès l'annonce ; les remettre en retard expose à une contestation du locataire et retarde la remise en conformité du dossier." },
    ],
    sources: [
      { label: "Service-Public : obligations du propriétaire bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059" },
      { label: "ANIL : diagnostics obligatoires", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/diagnostics/" },
      { label: "Légifrance : décret pièces justificatives (5 novembre 2015)", href: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031444493" },
    ],
  },
  {
    slug: "dpe-diagnostics-location",
    category: "preparer",
    title: "DPE et diagnostics locatifs 2026 : le dossier complet",
    shortTitle: "DPE et diagnostics",
    description: "À quoi sert le DPE, quels diagnostics réunir, leurs durées de validité et ce qui change selon la classe énergétique du logement.",
    updatedAt: "2026-06-28",
    intro:
      "Le dossier de diagnostic technique n'est pas un simple formulaire administratif. Chaque document produit engage la responsabilité du bailleur, conditionne parfois la possibilité de louer et doit être transmis au bon moment. La réglementation énergétique des locations a profondément évolué ces dernières années : un DPE archivé depuis 2019 peut être caduc aujourd'hui, et un logement classé G ne peut plus faire l'objet d'un nouveau bail.",
    sections: [
      {
        title: "Le rôle du DPE dans la location",
        paragraphs: [
          "Le diagnostic de performance énergétique (DPE) estime la consommation d'énergie et les émissions de CO2 d'un logement sur une échelle de A (très performant) à G (passoire thermique). Il est obligatoire dès la mise en annonce et doit être annexé au bail. Il est opposable au bailleur depuis 2021 : si les estimations sont manifestement erronées, le locataire peut engager la responsabilité du diagnostiqueur et du bailleur.",
          "Le DPE a une portée bien plus large qu'informationnelle. La classe énergétique détermine aujourd'hui si le logement peut légalement être loué, si le loyer peut être augmenté à la relocation, et — indirectement — la valeur de revente du bien. Un DPE G bloque la mise en location depuis le 1er janvier 2025. Un DPE F gèle le loyer à la relocation depuis août 2022.",
          "La validité d'un DPE est de 10 ans en principe, mais les DPE réalisés avant le 1er juillet 2021 sont devenus caducs le 1er janvier 2023 (pour ceux réalisés entre 2013 et 2017) et le 31 décembre 2024 (pour ceux réalisés entre 2018 et juin 2021). Vérifiez la date de réalisation avant de vous appuyer sur un ancien DPE.",
        ],
        note: "Pour vérifier si votre logement est en zone d'encadrement des loyers ou soumis au gel de relocation, consultez le site de l'ADIL de votre département.",
      },
      {
        title: "Les classes DPE et leurs conséquences locatives concrètes",
        paragraphs: [
          "Les obligations varient selon la classe énergétique. La classe G est la plus contraignante : aucun nouveau bail ne peut être signé depuis le 1er janvier 2025. Les baux en cours peuvent se poursuivre, mais à l'expiration du bail, le bailleur ne peut pas relouer sans effectuer des travaux. La classe F est autorisée à la location mais le loyer est gelé à la relocation.",
          "La classe E sera soumise à un gel de loyer à la relocation à partir de 2034 selon la feuille de route de la loi Climat. Les classes A à D ne subissent actuellement aucune restriction. Un logement A ou B constitue un argument commercial : la facture énergétique attendue du locataire est faible, ce qui justifie un loyer légèrement supérieur dans certains marchés.",
        ],
        bullets: [
          "Classe G : interdiction de louer pour les nouveaux baux depuis le 1er janvier 2025.",
          "Classe F : location autorisée mais loyer gelé à la relocation (depuis août 2022).",
          "Classe E : pas de restriction en 2026, mais à surveiller (calendrier législatif en évolution).",
          "Classes A à D : aucune restriction locative en 2026.",
          "Coût d'un DPE : entre 100 et 250 € selon le diagnostiqueur et la surface.",
        ],
      },
      {
        title: "Les diagnostics obligatoires selon le logement",
        paragraphs: [
          "Le constat de risque d'exposition au plomb (CREP) est obligatoire pour tous les logements dont le permis de construire est antérieur au 1er janvier 1949. En cas de présence de plomb à des concentrations supérieures au seuil réglementaire, le bailleur doit en informer le locataire et peut être tenu de réaliser des travaux. Le CREP a une durée de validité illimitée si le résultat est négatif.",
          "Les diagnostics gaz et électricité sont requis lorsque les installations intérieures ont plus de 15 ans. Ils permettent de repérer les anomalies pouvant présenter un risque pour la sécurité. Leur validité est de 6 ans pour un bien en location. Si des anomalies sont identifiées, le bailleur n'est pas obligé de réaliser immédiatement les travaux, mais il doit en informer le locataire.",
          "L'état des risques et pollutions (ERP) recense les risques naturels (inondation, séisme), technologiques (installations classées) et miniers auxquels le logement est exposé. Il est gratuit à établir via georisques.gouv.fr et doit être actualisé tous les 6 mois. Un ERP périmé fragilise le bail.",
        ],
        bullets: [
          "CREP (plomb) : logements avant 1949. Validité : illimitée si négatif, 6 ans si présence détectée.",
          "Diagnostic gaz : installation intérieure de plus de 15 ans. Validité : 6 ans.",
          "Diagnostic électricité : installation intérieure de plus de 15 ans. Validité : 6 ans.",
          "ERP (risques et pollutions) : tous logements, à actualiser tous les 6 mois. Gratuit.",
          "Diagnostic bruit : logements en zone d'exposition au bruit d'aérodrome (liste officielle).",
          "Amiante parties privatives : logements construits avant 1997, à conserver disponible sans obligation d'annexion.",
        ],
      },
      {
        title: "Le bon calendrier pour les diagnostics",
        paragraphs: [
          "Faites établir les diagnostics avant de publier l'annonce, pas au moment de la signature. La classe DPE et la surface Carrez (en copropriété) doivent figurer dans l'annonce. Un diagnostic électricité qui révèle un risque grave pourrait vous conduire à reporter la mise en location — mieux vaut le savoir avant d'avoir engagé des candidats.",
          "Archivez le dossier complet remis au locataire dans le bail et notez les dates d'expiration de chaque document. Pour un portefeuille de plusieurs biens, créez un tableau de suivi avec les échéances par logement. Un diagnostic qui expire en cours de bail n'oblige pas à le renouveler immédiatement, mais il faut en avoir un valide au moment de la prochaine signature de bail.",
        ],
        bullets: [
          "DPE : à afficher dans l'annonce (classe + valeur en kWh/m²/an et kgeqCO2/m²/an).",
          "ERP : à actualiser avant la signature si le précédent a plus de 6 mois.",
          "Diagnostics gaz/élec : à refaire si l'installation a été modifiée depuis le dernier diagnostic.",
          "Créer un rappel d'expiration pour chaque document dans son dossier logement.",
        ],
      },
      {
        title: "Quand un diagnostic révèle un problème",
        paragraphs: [
          "Un diagnostic défavorable ne vous condamne pas nécessairement à reporter la mise en location, mais il impose une décision éclairée. Un DPE F peut encore permettre la location, mais le loyer sera gelé. Un diagnostic électrique révélant une anomalie de niveau 1 (risque de choc électrique ou d'incendie) appelle une intervention rapide avant la mise en location.",
          "Conservez systématiquement la preuve de remise du diagnostic au locataire (annexé au bail signé) et la trace des décisions prises. Si vous avez connaissance d'un risque et que vous ne le signalez pas, vous engagez votre responsabilité civile et éventuellement pénale. En cas de doute sur l'interprétation d'un diagnostic, demandez conseil à votre ADIL ou à un avocat spécialisé.",
          "Si les travaux sont importants, évaluez leur impact sur la rentabilité du bien avant de louer. Un logement F rénové en D peut être reloué à un loyer supérieur après les travaux, justifiant parfois l'investissement avant la prochaine relocation.",
        ],
        bullets: [
          "Lire les conclusions, pas seulement la classe ou la date.",
          "Pour les anomalies de niveau 1 (gaz, élec) : intervention avant la mise en location recommandée.",
          "Informer le locataire de tout risque connu, même non bloquant.",
          "Conserver le diagnostic, la décision prise et la preuve de remise au locataire.",
          "Pour un DPE F ou G : consulter un conseiller France Rénov pour évaluer les travaux.",
        ],
        note: "Les diagnostics réalisés par un diagnostiqueur certifié sont opposables : s'ils sont erronés, la responsabilité du diagnostiqueur est engagée, pas uniquement celle du bailleur. Vérifiez la certification du prestataire.",
      },
    ],
    checklist: [
      "DPE valide et classe vérifiée (E ou mieux pour louer sans contrainte)",
      "CREP si logement antérieur à 1949",
      "Diagnostic gaz si installation de plus de 15 ans",
      "Diagnostic électricité si installation de plus de 15 ans",
      "ERP actualisé (moins de 6 mois)",
      "Diagnostic bruit si zone concernée",
      "Classe DPE affichée dans l'annonce",
      "DDT complet annexé au bail signé",
      "Copies archivées avec dates d'expiration",
      "Anomalies connues signalées au locataire",
    ],
    faq: [
      { q: "Un logement classé DPE G peut-il encore être loué en 2026 ?", a: "Non pour un nouveau bail : l'interdiction de mise en location des logements classés G s'applique depuis le 1er janvier 2025. Un bail G déjà en cours peut se poursuivre, mais ne pourra pas être reconduit ou reloué sans travaux de rénovation énergétique." },
      { q: "Un DPE réalisé il y a quelques années est-il encore valable ?", a: "Cela dépend de sa date de réalisation, pas seulement de son âge apparent. Les DPE réalisés entre 2013 et 2017 sont caducs depuis le 1er janvier 2023, et ceux réalisés entre 2018 et juin 2021 sont caducs depuis le 31 décembre 2024, même si la durée de validité théorique de 10 ans n'est pas écoulée. Vérifiez systématiquement la date de réalisation avant de vous y fier." },
      { q: "Le diagnostic électricité ou gaz oblige-t-il à faire des travaux immédiatement ?", a: "Pas automatiquement. Le bailleur n'est pas tenu de réaliser immédiatement les travaux liés à une anomalie détectée, sauf si elle présente un risque grave et immédiat (anomalie de niveau 1 : risque de choc électrique ou d'incendie), auquel cas une intervention rapide est fortement recommandée avant la mise en location. Dans tous les cas, le locataire doit être informé du risque connu." },
    ],
    sources: [
      { label: "Service-Public : diagnostics à fournir en location", href: "https://www.service-public.fr/particuliers/vosdroits/F33463" },
      { label: "ANIL : dossier de diagnostic technique", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/diagnostics/" },
      { label: "France Rénov : aides à la rénovation énergétique", href: "https://france-renov.gouv.fr" },
    ],
  },
  {
    slug: "lmnp-checklist-location-meublee",
    category: "preparer",
    title: "LMNP : la checklist pratique avant de louer un logement meublé",
    shortTitle: "Checklist LMNP",
    description: "Mobilier obligatoire, inventaire, déclaration de début d'activité, SIRET, CFE et choix fiscal : les points clés pour une location meublée conforme.",
    updatedAt: "2026-06-28",
    intro:
      "Louer en meublé ne consiste pas à ajouter quelques meubles à un logement vide. Le bien doit permettre une occupation normale dès l'entrée, l'inventaire doit être précis, et l'activité doit être déclarée dans les 15 jours. Un oubli dans la liste du mobilier peut entraîner une requalification du bail en location vide — avec des conséquences fiscales et contractuelles significatives.",
    sections: [
      {
        title: "La liste légale du mobilier obligatoire",
        paragraphs: [
          "Le décret du 31 juillet 2015 liste les 11 catégories d'équipements qu'un logement doit comporter pour être légalement qualifié de meublé. Cette liste est impérative : l'absence d'un seul élément peut être invoquée par le locataire pour demander la requalification du contrat en bail vide (durée de 3 ans, fiscalité revenus fonciers).",
          "Vérifiez chaque catégorie avant la remise des clés. Photographiez chaque équipement et intégrez les photos à l'inventaire daté et signé. En cas de remplacement d'un équipement en cours de bail, notez-le dans le dossier avec la facture.",
        ],
        bullets: [
          "Literie complète : matelas, sommier ou lit, couette ou couverture, oreiller.",
          "Occultation des fenêtres dans les chambres : volets, rideaux ou stores opaques.",
          "Plaques de cuisson (au moins 2 feux).",
          "Four ou four à micro-ondes.",
          "Réfrigérateur avec compartiment permettant de maintenir des aliments à -6°C minimum.",
          "Vaisselle en nombre suffisant pour les repas des occupants.",
          "Ustensiles de cuisine (casseroles, poêle, couteaux, etc.).",
          "Table et sièges en nombre suffisant.",
          "Étagères ou rangements.",
          "Luminaires dans toutes les pièces.",
          "Matériel d'entretien ménager adapté au logement (aspirateur, balai, serpillière, seau).",
        ],
        note: "Un logement non conforme à cette liste peut être requalifié en location vide par le tribunal judiciaire, sur demande du locataire. Cela entraîne l'application du bail vide (3 ans) et le passage aux revenus fonciers.",
      },
      {
        title: "Préparer un inventaire solide",
        paragraphs: [
          "L'inventaire du mobilier est annexé au bail meublé et à l'état des lieux d'entrée. Il doit être précis, daté et signé par les deux parties. Une description vague (\"1 canapé\") ne suffit pas : précisez l'état (bon état, traces d'usure visibles), la marque si possible et la quantité. Joignez des photos numérotées correspondant à chaque ligne de l'inventaire.",
          "L'inventaire sert de référence à l'état des lieux de sortie. Si un équipement est absent ou dégradé au départ du locataire, vous devez pouvoir prouver qu'il était présent et en bon état à l'entrée. Sans inventaire précis, aucune retenue sur le dépôt de garantie pour mobilier manquant ou dégradé n'est admissible.",
          "Conservez les factures d'achat des équipements importants (literie, électroménager). Elles prouvent l'état neuf ou récent à l'entrée dans les lieux, ce qui renforce votre position en cas de litige sur des dégradations.",
        ],
        bullets: [
          "Inventaire daté et signé par le bailleur et le locataire.",
          "Description précise : état, quantité, éventuellement marque.",
          "Photos numérotées jointes à l'inventaire.",
          "Factures d'achat conservées pour les équipements significatifs.",
          "Inventaire mis à jour en cas de remplacement d'équipement en cours de bail.",
        ],
      },
      {
        title: "Déclarer le début d'activité LMNP",
        paragraphs: [
          "La location meublée est une activité commerciale relevant des bénéfices industriels et commerciaux (BIC). Elle doit être déclarée sur le guichet des formalités des entreprises (formalites.entreprises.gouv.fr) dans les 15 jours suivant le premier jour de location. Cette déclaration génère un numéro SIRET, nécessaire pour les déclarations fiscales.",
          "Si vous oubliez cette déclaration, vous pouvez régulariser rétroactivement, mais cela peut attirer l'attention de l'administration fiscale. Le numéro SIRET est indispensable pour déposer la liasse 2031 au régime réel. Sans déclaration, vous n'êtes pas en conformité, même si vous déclarez vos revenus locatifs.",
          "Dès la deuxième année, vous serez redevable de la cotisation foncière des entreprises (CFE), calculée sur la valeur locative de vos biens. La première année est en principe exonérée. Certaines communes exonèrent également les loueurs meublés non professionnels — vérifiez auprès de votre service des impôts.",
        ],
        bullets: [
          "Délai de déclaration : 15 jours suivant le premier jour de location.",
          "Guichet officiel : formalites.entreprises.gouv.fr (formulaire P0i).",
          "Documents nécessaires : identité, adresse du bien, date de début d'activité.",
          "SIRET obtenu sous quelques semaines par courrier.",
          "CFE : due à partir de la 2e année, vérifier les exonérations locales.",
        ],
      },
      {
        title: "Choisir entre micro-BIC et régime réel",
        paragraphs: [
          "En dessous de 77 700 € de recettes locatives annuelles, vous pouvez opter pour le micro-BIC : un abattement forfaitaire de 50 % est appliqué, et vous êtes imposé sur la moitié de vos loyers bruts. Aucune comptabilité formelle n'est requise. C'est le régime par défaut si vous ne faites rien.",
          "Le régime réel simplifié LMNP permet de déduire les charges réelles (intérêts d'emprunt, taxe foncière, copropriété, assurance, frais de gestion) et d'amortir le bien immobilier ainsi que le mobilier. Pour un investisseur avec un crédit immobilier, le réel efface souvent entièrement l'imposition sur les loyers pendant 10 à 15 ans.",
          "Le point de bascule : si vos charges réelles dépassent 50 % de vos recettes locatives, le réel est plus avantageux que le micro-BIC. Dans la quasi-totalité des cas avec crédit immobilier, le réel s'impose. L'option pour le réel est reconductible chaque année — elle n'est pas irrévocable comme en revenus fonciers.",
        ],
        bullets: [
          "Micro-BIC : abattement 50 %, pas de comptabilité, idéal si peu de charges.",
          "Régime réel : charges déductibles + amortissement du bien (2,5 à 4 %/an) + mobilier.",
          "Avec un crédit, le réel est presque toujours plus avantageux.",
          "Expert-comptable recommandé au réel : 150 à 500 €/an, eux-mêmes déductibles.",
          "Option pour le réel : à exercer avant le 1er février de l'année concernée.",
        ],
      },
      {
        title: "L'amortissement : l'avantage clé du LMNP réel",
        paragraphs: [
          "L'amortissement est une charge comptable sans décaissement : elle simule l'usure du bien et réduit votre résultat imposable chaque année, sans que vous ne dépensiez un centime. En LMNP réel, vous pouvez amortir le bien immobilier (hors terrain), le mobilier et les travaux d'amélioration.",
          "Le bien est amorti par composants. La structure est amortie sur 50 ans (soit 2 % par an), la toiture sur 25 ans, les équipements sur 10 à 20 ans. Pour un appartement de 200 000 € (terrain estimé à 20 000 €), l'amortissement annuel tourne autour de 6 000 à 7 000 € par an. Le mobilier (environ 10 000 à 15 000 €) est amorti sur 5 à 10 ans, soit 1 500 à 2 500 €/an supplémentaires.",
          "Ces amortissements ne sont pas réintégrés dans le calcul de la plus-value à la revente en LMNP non professionnel — c'est l'un des derniers grands avantages fiscaux préservés par la loi. En pratique, beaucoup d'investisseurs paient zéro impôt sur leurs loyers pendant 10 à 20 ans grâce à cet effet combiné.",
        ],
        bullets: [
          "Amortissement du bâti (hors terrain) : 2 à 4 %/an selon les composants.",
          "Amortissement du mobilier : 10 à 20 %/an selon la nature des biens.",
          "Amortissements non réintégrés à la revente (LMNP non professionnel).",
          "Déficit BIC non imputable sur le revenu global, mais reportable sans limite.",
          "Calcul précis à confier à un expert-comptable pour optimiser les plans d'amortissement.",
        ],
      },
      {
        title: "Organiser les preuves utiles au LMNP",
        paragraphs: [
          "Le LMNP se gère mieux lorsque les informations sont classées dès le départ. Créez deux dossiers distincts par logement : un dossier \"relation locative\" (bail, état des lieux, quittances, échanges) et un dossier \"gestion fiscale\" (factures de mobilier et travaux, relevés de charges de copropriété, avis de taxe foncière, intérêts d'emprunt annuels, frais d'assurance).",
          "Pour l'expert-comptable, fournissez chaque année : le total des loyers encaissés, les relevés de charges de copropriété avec le décompte annuel, les attestations de taxe foncière, les certificats d'intérêts de votre banque, les factures de travaux et d'assurance. Une organisation rigoureuse réduit les honoraires comptables et évite les erreurs dans la liasse 2031.",
        ],
        bullets: [
          "Inventaire signé et photos archivés.",
          "Factures de mobilier et d'équipement conservées (preuve d'état à l'entrée).",
          "Relevés de loyers par année civile.",
          "Certificat annuel des intérêts d'emprunt (fourni par la banque).",
          "Décompte de charges de copropriété annuel.",
          "Avis de taxe foncière.",
          "Factures de travaux et d'entretien.",
          "Primes d'assurance PNO et GLI.",
        ],
      },
    ],
    checklist: [
      "11 catégories de mobilier obligatoires présentes",
      "Inventaire détaillé daté et signé",
      "Photos de chaque équipement",
      "Bail meublé conforme au modèle réglementaire",
      "Déclaration de début d'activité faite dans les 15 jours",
      "SIRET obtenu",
      "CFE vérifiée",
      "Micro-BIC vs réel comparé",
      "Expert-comptable contacté si réel choisi",
      "Dossier fiscal séparé créé",
    ],
    faq: [
      { q: "Que risque-t-on si un seul élément du mobilier obligatoire manque ?", a: "Le locataire peut demander au tribunal judiciaire la requalification du bail meublé en bail vide (durée de 3 ans, dépôt de garantie limité à 1 mois, fiscalité en revenus fonciers au lieu du BIC) si un seul des 11 catégories d'équipements listées par le décret du 31 juillet 2015 est absent. C'est pourquoi l'inventaire photographié et daté est indispensable." },
      { q: "Dans quel délai faut-il déclarer le début d'activité LMNP ?", a: "Dans les 15 jours suivant le premier jour de location, via le guichet unique des formalités des entreprises (formalites.entreprises.gouv.fr, formulaire P0i). Cette déclaration génère le numéro SIRET nécessaire pour toute déclaration fiscale ultérieure, notamment la liasse 2031 au régime réel." },
      { q: "Micro-BIC ou régime réel : lequel choisir en LMNP ?", a: "Le régime réel devient presque toujours plus avantageux dès que vous avez un crédit immobilier en cours, car il permet de déduire les charges réelles et d'amortir le bien et le mobilier — un mécanisme qui efface souvent l'imposition sur les loyers pendant 10 à 20 ans. Le micro-BIC (abattement forfaitaire de 50 %) reste pertinent si vos charges réelles restent inférieures à la moitié de vos recettes." },
    ],
    sources: [
      { label: "Impots.gouv.fr : location meublée", href: "https://www.impots.gouv.fr/particulier/location-meublee" },
      { label: "Guichet formalités des entreprises", href: "https://formalites.entreprises.gouv.fr" },
      { label: "Légifrance : décret mobilier meublé (31 juillet 2015)", href: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031040725" },
    ],
  },
  {
    slug: "choisir-bail-vide-meuble-mobilite",
    category: "preparer",
    title: "Location vide, meublée ou bail mobilité : choisir le contrat adapté",
    shortTitle: "Choisir le bon bail",
    description: "Comparer les durées, dépôts de garantie, préavis, règles de relocation et implications fiscales avant de signer.",
    updatedAt: "2026-06-28",
    intro:
      "Le bon bail n'est pas celui qui semble le plus souple : c'est celui qui correspond à la réalité du logement, à la situation du locataire et à vos objectifs. Une qualification artificielle (meublé sans mobilier complet, mobilité sans justificatif) fragilise le bail et vous expose à une requalification judiciaire. Prenez 10 minutes pour comparer les options avant de choisir.",
    sections: [
      {
        title: "Les quatre contrats possibles en un coup d'œil",
        paragraphs: [
          "Le droit locatif français offre quatre cadres contractuels principaux pour la résidence principale : la location vide, la location meublée, le bail mobilité et le bail étudiant. Chacun a ses propres règles sur la durée, le dépôt de garantie, le préavis et la fiscalité. Un seul bien peut faire l'objet de contrats différents selon les locataires qui se succèdent.",
        ],
        bullets: [
          "Location vide : bail 3 ans, dépôt 1 mois HC, préavis locataire 3 mois (1 mois zone tendue), fiscalité revenus fonciers.",
          "Location meublée : bail 1 an, dépôt 2 mois HC, préavis locataire 1 mois (partout), fiscalité BIC.",
          "Bail mobilité : 1 à 10 mois, dépôt de garantie interdit, pas de préavis légal fixe, profils éligibles limités.",
          "Bail étudiant : 9 mois non renouvelable, dépôt 2 mois HC, logement libéré en fin d'année universitaire.",
        ],
      },
      {
        title: "La location vide : stabilité et bail long",
        paragraphs: [
          "La location vide convient aux grandes surfaces (T3, T4, maisons) destinées à une occupation familiale longue durée. Elle offre au bailleur une stabilité locative (3 ans minimum) mais réduit sa flexibilité : il ne peut récupérer le bien qu'en fin de bail, uniquement pour vendre, reprendre pour l'habiter ou invoquer un motif légitime et sérieux. Le préavis du bailleur est de 6 mois avant l'échéance.",
          "La fiscalité relève des revenus fonciers. En micro-foncier (sous 15 000 €/an de loyers bruts), l'abattement est de 30 %. Au régime réel, toutes les charges sont déductibles et un déficit foncier peut s'imputer sur le revenu global (10 700 €/an maximum). L'amortissement du bien n'est pas possible.",
          "Les baux vides sont soumis aux modèles types réglementaires. Certaines clauses abusives sont réputées non écrites : vérifiez la conformité du contrat avant la signature, notamment si vous utilisez un modèle ancien ou trouvé en ligne.",
        ],
        bullets: [
          "Durée minimale : 3 ans (reconduit tacitement par périodes de 3 ans).",
          "Dépôt de garantie : 1 mois de loyer hors charges.",
          "Préavis locataire : 3 mois (réduit à 1 mois en zone tendue ou perte d'emploi, RSA, mutation).",
          "Préavis bailleur : 6 mois avant l'échéance, motif limité (vente, reprise, motif légitime).",
          "Fiscalité : revenus fonciers (micro-foncier 30 % ou régime réel).",
        ],
      },
      {
        title: "La location meublée : flexibilité et avantage fiscal",
        paragraphs: [
          "La location meublée convient aux petites surfaces (studio, T1, T2) proches de pôles universitaires ou économiques. Le locataire type est un étudiant, un jeune actif en mobilité professionnelle ou un expatrié. La flexibilité est réelle : le bailleur peut ne pas renouveler le bail à l'échéance avec seulement 3 mois de préavis, sans avoir à justifier d'un motif limité.",
          "L'avantage fiscal est substantiel. Au micro-BIC, l'abattement est de 50 % (contre 30 % en micro-foncier). Au régime réel, les charges sont déductibles et l'amortissement du bien et du mobilier efface souvent l'intégralité de l'imposition pendant 10 à 20 ans. En contrepartie, le mobilier doit être conforme à la liste réglementaire et le début d'activité doit être déclaré.",
          "Le loyer meublé est généralement 10 à 20 % supérieur à un loyer vide comparable, ce qui compense partiellement le coût d'équipement du logement. En zone encadrée, le loyer de référence majoré pour un meublé est légèrement supérieur à celui d'un logement vide de même catégorie.",
        ],
        bullets: [
          "Durée minimale : 1 an (reconduit tacitement).",
          "Dépôt de garantie : 2 mois de loyer hors charges.",
          "Préavis locataire : 1 mois partout (zone tendue ou non).",
          "Préavis bailleur : 3 mois avant l'échéance, motifs identiques à la location vide.",
          "Fiscalité : BIC (micro-BIC 50 % ou réel avec amortissements).",
          "Mobilier obligatoire : 11 catégories selon le décret du 31 juillet 2015.",
        ],
      },
      {
        title: "Le bail mobilité : usage limité et conditions strictes",
        paragraphs: [
          "Le bail mobilité est un contrat de location meublée de courte durée (1 à 10 mois), créé par la loi Elan de 2018. Il ne peut être utilisé qu'avec des locataires justifiant d'une situation de mobilité précise : formation professionnelle, études supérieures, contrat d'apprentissage, stage, engagement volontaire dans le service civique, mutation professionnelle ou mission temporaire.",
          "Le locataire doit fournir un justificatif de sa situation au moment de la signature. Le bail ne peut être ni renouvelé ni reconduit : à l'expiration, le logement est libéré. Le bailleur ne peut exiger de dépôt de garantie, mais peut demander la caution Visale (gratuite, proposée par Action Logement).",
          "N'utilisez pas le bail mobilité comme une version courte universelle du bail meublé. Si le locataire ne remplit pas les conditions d'éligibilité, le bail peut être requalifié en bail meublé classique d'un an par le juge.",
        ],
        bullets: [
          "Durée : 1 mois minimum, 10 mois maximum, non renouvelable.",
          "Dépôt de garantie : interdit.",
          "Profils éligibles : formation, études, stage, apprentissage, mission temporaire, mutation pro.",
          "Justificatif obligatoire : à joindre au bail ou à exiger avant la signature.",
          "Visale recommandée à défaut de dépôt de garantie.",
        ],
      },
      {
        title: "Le bail étudiant 9 mois : libérer le logement pour l'été",
        paragraphs: [
          "Le bail étudiant est une variante du bail meublé qui dure 9 mois et n'est pas reconduit tacitement. Il est réservé aux étudiants justifiant de leur statut. À l'expiration (généralement en juin), le locataire quitte les lieux sans préavis et le bailleur récupère son bien pour le relouer, le rénover ou l'utiliser pendant l'été.",
          "C'est une option intéressante pour les logements situés dans des villes universitaires à forte demande, mais avec une gestion plus intensive (état des lieux et relocation chaque année). Le dépôt de garantie est de 2 mois comme pour un bail meublé classique.",
        ],
        bullets: [
          "Durée : 9 mois fixes, non renouvelables.",
          "Profil : étudiant justifiant de son inscription.",
          "Dépôt de garantie : 2 mois HC.",
          "Avantage : logement libre chaque été pour travaux ou autre usage.",
          "Inconvénient : rotation annuelle, état des lieux et remise en location tous les ans.",
        ],
      },
      {
        title: "L'impact de l'encadrement des loyers selon le bail",
        paragraphs: [
          "L'encadrement des loyers s'applique indépendamment du type de bail. Dans les zones concernées (Paris, Lyon, Bordeaux, Lille, Montpellier et d'autres communes), le loyer est plafonné par un loyer de référence majoré déterminé par décret préfectoral. Ce plafond varie selon le type de bail (vide ou meublé), le nombre de pièces, la période de construction et le quartier.",
          "En pratique, le loyer de référence majoré pour un logement meublé est légèrement supérieur à celui d'un logement vide. L'écart est souvent de 10 à 15 %. Vérifiez les loyers de référence applicables avant de fixer votre loyer, quelle que soit la formule choisie.",
        ],
        bullets: [
          "Encadrement applicable : Paris, Lyon, Bordeaux, Lille, Montpellier (liste évolutive).",
          "Loyer de référence majoré meublé > vide (environ 10-15 %).",
          "Relocation en zone tendue : gel du loyer sauf exceptions (travaux, loyer sous-évalué).",
          "Complément de loyer possible pour logements exceptionnels (vue exceptionnelle, terrasse, etc.).",
        ],
      },
      {
        title: "Décider selon votre profil et vos objectifs",
        paragraphs: [
          "Choisissez la location vide si vous louez un T3 ou plus, si vous ciblez des familles ou des locataires longue durée, si votre tranche d'imposition est faible ou si vous avez des travaux importants à réaliser (déficit foncier en location nue).",
          "Choisissez la location meublée si vous louez un studio ou T2 dans une ville étudiante ou dynamique, si votre tranche d'imposition est de 30 % ou plus, et si vous souhaitez optimiser fiscalement grâce aux amortissements. Le bail mobilité est une option complémentaire pour des locations très courtes si les locataires sont éligibles.",
        ],
        bullets: [
          "Grande surface + famille + stabilité → location vide.",
          "Petite surface + étudiant ou actif mobile + TMI élevée → location meublée.",
          "Besoin de flexibilité maximale + profil éligible → bail mobilité.",
          "Ville universitaire + logement libéré l'été → bail étudiant 9 mois.",
        ],
      },
    ],
    faq: [
      { q: "Peut-on utiliser un bail mobilité pour n'importe quel locataire souhaitant une courte durée ?", a: "Non. Le bail mobilité est réservé à des profils précis justifiant d'une situation de mobilité (formation, études supérieures, stage, apprentissage, mission temporaire, mutation professionnelle). Si le locataire ne remplit pas ces conditions, le juge peut requalifier le contrat en bail meublé classique d'un an, avec toutes les conséquences que cela implique (préavis, dépôt de garantie possible)." },
      { q: "Quelle est la vraie différence de fiscalité entre location vide et location meublée ?", a: "La location vide relève des revenus fonciers (abattement micro-foncier de 30 %, ou régime réel avec déficit foncier imputable jusqu'à 10 700 €/an). La location meublée relève des BIC (abattement micro-BIC de 50 %, ou régime réel avec amortissement du bien et du mobilier). Avec un crédit immobilier en cours, le meublé au régime réel efface le plus souvent l'imposition sur les loyers pendant 10 à 20 ans, ce que la location vide ne permet pas." },
      { q: "Peut-on changer de type de bail en cours de location avec le même locataire ?", a: "Non, le type de bail (vide, meublé, mobilité, étudiant) est fixé à la signature et ne peut pas être modifié unilatéralement en cours de contrat. Un changement suppose la résiliation du bail existant et la signature d'un nouveau contrat, ce qui n'est possible qu'avec l'accord du locataire ou à l'échéance normale du bail." },
    ],
    sources: [
      { label: "Service-Public : rédaction du bail d'habitation vide", href: "https://www.service-public.fr/particuliers/vosdroits/F35109/0_0?idFicheParent=F920" },
      { label: "Impots.gouv.fr : les locations meublées", href: "https://www.impots.gouv.fr/particulier/les-locations-meublees" },
      { label: "ANIL : comparatif bail vide et bail meublé", href: "https://www.anil.org" },
    ],
  },
  {
    slug: "choisir-son-locataire",
    category: "arrivee",
    title: "Choisir son locataire : critères légaux et solvabilité",
    shortTitle: "Choisir son locataire",
    description: "Comment sélectionner un locataire dans le respect de la loi : pièces autorisées, taux d'effort, comparaison des dossiers, garant, GLI et notification de la décision.",
    updatedAt: "2026-07-23",
    intro:
      "Choisir son locataire est souvent perçu comme une décision intuitive, mais elle repose sur un cadre légal précis. Le bailleur peut exiger certaines pièces, évaluer la solvabilité, demander un garant — et pas davantage. Dépasser ces limites expose à des sanctions pénales. Rester en deçà, c'est risquer de retenir un dossier insuffisant. Ce guide détaille les critères légaux, les pièces autorisées, la méthode pour comparer plusieurs candidatures et les bonnes pratiques pour notifier une décision.",
    sections: [
      {
        title: "1. Les critères légaux : les pièces justificatives autorisées",
        paragraphs: [
          "Le décret du 5 novembre 2015 (décret Alur) définit la liste limitative des pièces qu'un bailleur peut demander à un candidat locataire. Demander une pièce non listée — ou refuser de louer faute d'une pièce interdite — constitue une pratique discriminatoire ou illégale susceptible d'être sanctionnée.",
          "Pour justifier de son identité, le candidat peut fournir une CNI (recto-verso) ou un passeport en cours de validité. Pour sa situation professionnelle, les justificatifs autorisés sont le contrat de travail (ou à défaut, une attestation employeur), les trois derniers bulletins de salaire, et le dernier avis d'imposition ou de non-imposition. Si le candidat est indépendant ou dirigeant, les deux derniers bilans ou une attestation comptable sont acceptés.",
          "Pour justifier du logement actuel, le candidat peut fournir une quittance de loyer, une attestation d'hébergement ou les trois dernières quittances. L'ensemble de ces documents représente le maximum que vous êtes en droit de demander.",
        ],
        bullets: [
          "Identité : CNI ou passeport en cours de validité.",
          "Situation pro (salarié) : contrat de travail + 3 derniers bulletins de salaire.",
          "Situation pro (indépendant/gérant) : 2 derniers bilans ou attestation comptable + K-bis récent.",
          "Avis d'imposition : dernier avis disponible (ou de non-imposition).",
          "Justificatif de domicile actuel : quittance, attestation d'hébergement.",
          "Étudiant sans revenu : carte étudiante + attestation de bourse ou justificatif de garant.",
        ],
        note: "Si le candidat ne parle pas français, un document d'identité rédigé en langue étrangère est admissible. Vous ne pouvez pas exiger une traduction certifiée.",
      },
      {
        title: "2. Ce qu'il est strictement interdit de demander",
        paragraphs: [
          "La même réglementation dresse la liste des pièces interdites. Les demander constitue une infraction passible d'une amende de 3 000 € pour une personne physique et 15 000 € pour une personne morale, ainsi que d'un recours du candidat lésé devant le Défenseur des droits ou le tribunal judiciaire.",
          "Sont expressément interdits : le relevé de compte bancaire, le contrat de mariage ou de PACS, l'attestation de bonne tenue de compte, toute pièce relative au patrimoine autre que la déclaration d'impôts, la photo d'identité, l'extrait de casier judiciaire, le dossier médical ou état de santé, et toute attestation sur l'honneur concernant la vie privée.",
          "Il est également interdit de faire remplir un formulaire de renseignements sur la vie personnelle du candidat (religion, opinion politique, origines, situation familiale). Tout refus fondé sur ces éléments constitue une discrimination à l'accès au logement, punie de 3 ans d'emprisonnement et 45 000 € d'amende.",
        ],
        bullets: [
          "Interdit : relevé de compte bancaire.",
          "Interdit : RIB ou IBAN.",
          "Interdit : extrait de casier judiciaire.",
          "Interdit : photo d'identité.",
          "Interdit : contrat de mariage ou de PACS.",
          "Interdit : attestation de bonne tenue de compte.",
          "Interdit : état de santé ou dossier médical.",
          "Interdit : tout critère lié à l'origine, la religion, l'orientation sexuelle, la situation familiale ou le handicap.",
        ],
      },
      {
        title: "3. Le critère de solvabilité : la règle des 3x et ses nuances",
        paragraphs: [
          "La règle des 3x est un usage professionnel, non une obligation légale. Elle signifie que les revenus nets mensuels du candidat doivent être au moins égaux à 3 fois le loyer charges comprises. Pour un loyer de 900 € cc, le revenu minimum attendu est de 2 700 € net/mois. Cette règle s'applique aux revenus du foyer si plusieurs personnes cohabitent.",
          "Certains profils solvables peuvent ne pas atteindre ce seuil sans pour autant présenter un risque réel. Un retraité avec une pension stable de 1 800 € pour un loyer de 700 € est objectivement plus fiable qu'un CDI à 2 800 € en période d'essai. Regardez la stabilité des revenus dans la durée, pas seulement le montant brut.",
          "Si le candidat a des revenus variables (freelance, CDD, commissions), analysez les 3 derniers bulletins et, si possible, l'avis d'imposition. Une moyenne annuelle est plus pertinente qu'un mois isolé. L'avis d'imposition donne également une vision des revenus nets après prélèvements, plus représentative de la capacité de paiement réelle.",
        ],
        bullets: [
          "Règle des 3x : revenus nets ≥ 3 × loyer cc (usage professionnel, non obligatoire légalement).",
          "Préférer la stabilité (CDI, fonctionnaire, retraité) à l'ancienneté seule.",
          "Pour les indépendants : analyser la moyenne sur 3 ans via les bilans.",
          "Revenus du foyer : prendre en compte tous les revenus réguliers (salaires, pensions, allocations).",
          "Avis d'imposition : clé pour vérifier la cohérence entre bulletins déclarés et revenus réels.",
        ],
        note: "Vous pouvez refuser un dossier pour revenus insuffisants même si le candidat déclare des revenus supérieurs, si les justificatifs ne permettent pas de le vérifier. Documentez le motif du refus.",
      },
      {
        title: "4. Vérifier la cohérence du dossier",
        paragraphs: [
          "Un dossier solide est un dossier cohérent. Vérifiez que le nom sur la pièce d'identité correspond bien au nom sur les bulletins de salaire. Le salaire net sur les bulletins doit être proche du revenu déclaré sur l'avis d'imposition (un écart important peut signaler des revenus non déclarés ou une erreur).",
          "Vérifiez que le contrat de travail est en cours de validité à la date de la candidature. Un CDD dont la date de fin correspond à 2 mois après la signature du bail n'offre pas la même garantie qu'un CDI confirmé. Si le contrat est récent (période d'essai), demandez si possible la durée de l'essai et la date prévisionnelle de confirmation.",
          "Pour les employeurs inconnus ou les structures atypiques, une recherche rapide sur le SIRET (via societe.ninja ou infogreffe.fr) permet de vérifier que l'entreprise existe, son activité et sa date de création. Une entreprise créée il y a 2 mois par un candidat indépendant pose davantage de questions qu'une PME existant depuis 10 ans.",
        ],
        bullets: [
          "Cohérence identité : nom identique sur CNI, bulletins et avis d'imposition.",
          "Cohérence revenus : salaire net bulletin ≈ revenu déclaré (tolérance ±10-15 % pour charges diverses).",
          "Contrat de travail : vérifier la date de fin si CDD, la durée d'essai si CDI récent.",
          "Bulletins : vérifier les 3 mois et non pas un seul (primes ponctuelles peuvent gonfler un mois).",
          "Employeur inconnu : vérification SIRET sur infogreffe.fr ou societe.ninja.",
        ],
      },
      {
        title: "5. Comparer les dossiers selon des critères objectifs",
        paragraphs: [
          "Lorsque plusieurs candidatures sont reçues simultanément, la comparaison doit reposer sur des critères objectifs et homogènes. Définissez à l'avance vos critères de sélection (revenus, stabilité professionnelle, complétude du dossier, garant) et appliquez-les à tous les candidats de la même façon.",
          "Un tableau de comparaison simple suffit : pour chaque candidat, notez le ratio revenus/loyer, la situation professionnelle, la présence d'un garant et la complétude du dossier. Cela vous permet de justifier votre choix par écrit si un candidat non retenu conteste la décision.",
          "lokt.fr calcule automatiquement un score de profil pour chaque dossier, combinant les revenus, la stabilité professionnelle, la complétude du dossier et la présence d'un garant. Ce score est un outil d'aide à la décision : il ne remplace pas votre analyse, mais il facilite la comparaison à vue.",
        ],
        bullets: [
          "Définir ses critères avant de recevoir les dossiers, pas après.",
          "Appliquer les mêmes critères à tous les candidats.",
          "Conserver une trace écrite du classement et du motif de sélection.",
          "Ne pas retenir un dossier sur la base d'un seul critère.",
          "Utiliser le score lokt comme aide à la décision, non comme décision automatique.",
        ],
        note: "Si deux dossiers sont équivalents, la date de réception est souvent le critère de départage le plus neutre et le moins contestable.",
      },
      {
        title: "6. Le garant : quand l'exiger et sous quelle forme",
        paragraphs: [
          "Le garant (ou caution) est une personne physique ou morale qui s'engage à régler les dettes locatives du locataire à défaut de paiement. Vous pouvez en exiger un si vous n'avez pas souscrit de garantie loyers impayés (GLI) — et seulement dans ce cas, sauf si le locataire est étudiant ou apprenti.",
          "La caution doit signer un acte de cautionnement qui reprend le montant du loyer et ses obligations. La loi exige que le garant recopie de sa main une mention précise (article 22-1 de la loi du 6 juillet 1989). Si la mention manuscrite est absente ou incomplète, la caution est nulle et inopposable. Vérifiez ce point avant la signature du bail.",
          "Vous pouvez également vous appuyer sur le dispositif Visale (Action Logement), une garantie gratuite proposée aux locataires de moins de 30 ans (ou plus si mutations professionnelles). En cas d'impayé, Action Logement règle les loyers et engage ensuite une procédure de recouvrement auprès du locataire. C'est une alternative solide à la caution solidaire classique.",
          "Sur lokt.fr, le candidat déclare son garant directement depuis le formulaire de candidature, en choisissant entre deux types : garant individuel (personne physique, avec les mêmes pièces que le candidat lui-même — identité, avis d'imposition et 3 dernières fiches de paie) ou garantie Visale (numéro de visa uniquement, aucun justificatif de revenu du garant à fournir). Si le candidat est étudiant et déclare un garant — quel que soit son type — son propre justificatif de revenu n'est plus exigé dans le dossier. Ces informations sont ensuite reprises automatiquement dans la fiche locataire lors de la conversion du candidat retenu.",
        ],
        bullets: [
          "Garant autorisé : si pas de GLI souscrite par le bailleur (sauf locataire étudiant ou apprenti).",
          "Acte de cautionnement : mention manuscrite obligatoire (article 22-1 loi 1989).",
          "Caution à durée limitée (bail) ou indéterminée : dans les deux cas, une résiliation par LRAR est possible avec un délai de préavis.",
          "Visale : garantie gratuite d'Action Logement, éligible sous conditions, alternative solide.",
          "Caution solidaire vs simple : la solidaire est immédiatement actionnable ; la simple impose une mise en demeure infructueuse du locataire d'abord.",
          "Sur lokt : le candidat choisit le type de garant (individuel avec pièces, ou Visale avec numéro de visa) ; le revenu propre d'un candidat étudiant est automatiquement dispensé dès qu'un garant est déclaré.",
        ],
      },
      {
        title: "7. GLI et caution solidaire : la règle du non-cumul",
        paragraphs: [
          "La garantie loyers impayés (GLI) est une assurance souscrite par le bailleur auprès d'un assureur ou d'un organisme agréé. Elle couvre les impayés de loyers et de charges, souvent les dégradations immobilières, et parfois les frais de procédure. En contrepartie, la prime annuelle représente généralement 2 à 4 % du loyer annuel charges comprises.",
          "La loi interdit de cumuler une GLI avec une caution solidaire d'une personne physique — sauf si le locataire est étudiant ou apprenti. En pratique, cela signifie que si vous avez souscrit une GLI, vous ne pouvez pas demander en plus un garant personne physique. Si vous préférez un garant, renoncez à la GLI.",
          "Les deux options ne s'équivalent pas. La GLI offre une couverture plus large (y compris en cas de disparition ou insolvabilité du garant) et une procédure de remboursement plus rapide. Le garant est gratuit mais peut lui-même devenir insolvable ou décéder. Pour les biens de valeur, la GLI est généralement préférée.",
        ],
        bullets: [
          "Règle : GLI ET caution solidaire personne physique = interdit (sauf étudiant ou apprenti).",
          "GLI : coût 2-4 % du loyer annuel cc, couverture large, procédure rapide.",
          "Caution solidaire : gratuite, actionnable immédiatement, mais risque d'insolvabilité du garant.",
          "Visale : compatible avec la GLI pour certains profils — vérifiez avec l'assureur.",
          "Choisir avant de recevoir les candidatures, pas après.",
        ],
      },
      {
        title: "8. Notifier la décision et conserver les traces",
        paragraphs: [
          "Une fois votre choix fait, informez le candidat retenu par écrit (email) et attendez sa confirmation avant de refuser les autres. Il arrive que le candidat retenu en premier lieu se désiste à la dernière minute — conservez donc les coordonnées des dossiers suivants.",
          "Pour les candidats non retenus, une notification par email suffit. Il n'est pas légalement obligatoire de justifier le refus, mais indiquer un motif objectif et non discriminatoire (dossier incomplet, revenus insuffisants) protège le bailleur en cas de contestation. Conservez ces emails au moins un an.",
          "lokt.fr vous permet de mettre les candidats en statut 'refusé', 'liste d'attente' ou 'retenu' directement depuis l'espace bailleur. Le candidat retenu peut ensuite être converti en locataire dans votre espace de gestion, ce qui déclenche la création de son profil de locataire et la gestion du bail.",
        ],
        bullets: [
          "Candidat retenu : confirmer par écrit et attendre sa confirmation avant de refuser les autres.",
          "Candidats refusés : notifier par email, motif objectif recommandé.",
          "Conserver les emails de notification au moins 1 an.",
          "Dossiers refusés : à conserver 1 an minimum en cas de contestation.",
          "Sur lokt : utilisez les statuts 'refusé' / 'liste d'attente' / 'retenu' pour garder une trace.",
        ],
        note: "Si un candidat non retenu vous contacte pour connaître le motif du refus, restez factuel : 'Votre dossier n'a pas été retenu en raison de revenus insuffisants au regard du critère de 3x le loyer' est une réponse légale et neutre. Évitez toute mention de la situation personnelle, familiale ou de l'origine.",
      },
    ],
    checklist: [
      "Pièces demandées limitées à la liste légale (décret 5 nov. 2015)",
      "Aucune pièce interdite demandée (RIB, photo, casier...)",
      "Revenus vérifiés : cohérence bulletins, contrat et avis d'imposition",
      "Taux d'effort calculé (revenus nets ≥ 3× loyer cc)",
      "Dossier analysé globalement (stabilité pro + docs + garant)",
      "Comparaison multi-dossiers sur critères homogènes",
      "Choix GLI ou caution solidaire fait avant la sélection",
      "Acte de cautionnement avec mention manuscrite vérifié",
      "Candidat retenu confirmé par écrit avant refus des autres",
      "Candidats non retenus informés par email avec motif objectif",
    ],
    faq: [
      { q: "Peut-on demander un relevé de compte bancaire pour vérifier la solvabilité d'un candidat ?", a: "Non, c'est expressément interdit par le décret du 5 novembre 2015 et passible d'une amende de 3 000 € (personne physique) à 15 000 € (personne morale). Les seules pièces autorisées pour la situation professionnelle sont le contrat de travail, les 3 derniers bulletins de salaire et le dernier avis d'imposition — jamais de RIB, relevé bancaire ou attestation de bonne tenue de compte." },
      { q: "La règle des 3 fois le loyer est-elle une obligation légale ?", a: "Non, c'est un usage professionnel largement répandu, pas une règle imposée par la loi. Elle sert de repère (revenus nets ≥ 3 × loyer charges comprises) mais doit être nuancée selon la stabilité des revenus : un retraité avec une pension stable peut être plus fiable qu'un CDI en période d'essai à revenus supérieurs." },
      { q: "Peut-on cumuler une garantie loyers impayés (GLI) et un garant personne physique ?", a: "Non, sauf si le locataire est étudiant ou apprenti. La loi interdit le cumul d'une GLI avec une caution solidaire d'une personne physique pour tous les autres profils — il faut choisir l'une ou l'autre avant de recevoir les candidatures." },
    ],
    sources: [
      { label: "Légifrance : décret pièces justificatives (5 novembre 2015)", href: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031444493" },
      { label: "Service-Public : choisir son locataire", href: "https://www.service-public.fr/particuliers/vosdroits/F1169" },
      { label: "ANIL : cautionnement et garantie loyers impayés", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/cautions-et-garanties/" },
      { label: "Action Logement : Visale", href: "https://www.visale.fr" },
    ],
  },
  {
    slug: "arrivee-locataire-remise-cles",
    category: "arrivee",
    title: "Arrivée du locataire : réussir la remise des clés et le démarrage du bail",
    shortTitle: "Arrivée du locataire",
    description: "Le déroulé concret de la signature à l'état des lieux d'entrée : documents, compteurs, preuves et bonnes pratiques pour un démarrage solide.",
    updatedAt: "2026-06-28",
    intro:
      "L'entrée dans les lieux est un moment court mais fondateur. Les preuves constituées ce jour-là — état des lieux, photos, relevés de compteurs, signatures — serviront de référence pendant toute la durée du bail et conditionneront la gestion du départ. Un état des lieux bâclé ou un inventaire imprécis peut rendre impossible toute retenue légitime sur le dépôt de garantie.",
    sections: [
      {
        title: "Les documents à préparer avant le rendez-vous",
        paragraphs: [
          "Préparez l'ensemble des documents avant le jour J. Le bail et ses annexes doivent être prêts à signer : ne laissez pas de champ vide à compléter lors du rendez-vous. Vérifiez que l'attestation d'assurance habitation du locataire est valide et couvre bien les risques locatifs — vous avez le droit de ne pas remettre les clés tant que ce document n'est pas fourni.",
          "Pour un logement meublé, préparez l'inventaire du mobilier avec la liste de chaque équipement et son état. Joignez les photos prises avant la remise des clés. Pour un logement vide, vérifiez que le DDT est complet et joint au bail.",
        ],
        bullets: [
          "Bail et toutes ses annexes prêts à signer (DDT, notice d'information, règlement de copropriété).",
          "Attestation d'assurance multirisque habitation du locataire à jour.",
          "Inventaire du mobilier pour un meublé (avec photos).",
          "Nombre exact de clés, badges, télécommandes et passes à remettre.",
          "Relevé de compteurs préparé (eau froide, eau chaude, électricité, gaz si applicable).",
          "Coordonnées des fournisseurs d'énergie et du gestionnaire de l'immeuble.",
        ],
      },
      {
        title: "Réaliser un état des lieux d'entrée précis",
        paragraphs: [
          "L'état des lieux d'entrée est un document contradictoire : il doit être réalisé en présence du locataire (ou de son représentant), signé par les deux parties et remis en deux exemplaires. Si vous ne pouvez pas faire l'état des lieux conjointement, vous pouvez faire appel à un huissier de justice — les frais sont alors partagés. Un état des lieux réalisé après la remise des clés ou sans la présence du locataire est plus facile à contester.",
          "Passez chaque pièce méthodiquement dans de bonnes conditions d'éclairage. Décrivez précisément l'état de chaque surface, équipement et installation : évitez les formulations comme \"bon état général\" — préférez \"murs sains, aucune marque visible\" ou \"carrelage intact, joint neuf\". Chaque défaut doit être localisé et décrit : \"tache de peinture sur le mur sud de la chambre, à 1 m du sol, 5 cm de diamètre\".",
          "Ajoutez des photos numérotées avec une date et heure automatique (option à activer sur les smartphones). Envoyez ensuite les photos par email au locataire dans les 24 heures : cela crée une preuve datée et opposable. Les photos seules ne remplacent pas l'état des lieux écrit, mais elles le renforcent considérablement.",
        ],
        bullets: [
          "Réalisé en présence du locataire ou de son représentant.",
          "Signé par les deux parties le même jour.",
          "Descriptions précises et localisées (pas de formulations vagues).",
          "Photos numérotées avec date et heure automatique.",
          "Envoi des photos par email au locataire dans les 24 heures.",
          "Pour un meublé : rapprochement pièce par pièce avec l'inventaire.",
          "Remise d'un exemplaire signé au locataire.",
        ],
        note: "Si des défauts apparaissent dans les 10 jours suivant la remise des clés, le locataire peut demander à compléter l'état des lieux d'entrée. Traitez ces demandes rapidement par écrit.",
      },
      {
        title: "Relever les compteurs et organiser les contrats d'énergie",
        paragraphs: [
          "Relevez les compteurs d'eau, d'électricité et de gaz en présence du locataire et notez les index dans l'état des lieux. Ces relevés servent de point de départ pour la facturation du locataire. Si le compteur est mutualisé, précisez dans le bail comment les charges sont réparties.",
          "En logement individuel (compteurs séparés), le locataire doit souscrire ses propres contrats d'énergie. Fournissez-lui les coordonnées du fournisseur actuel et le numéro de point de livraison (PDL pour l'électricité, PCE pour le gaz) afin de faciliter le transfert. Si vous interrompez votre propre contrat avant l'entrée du locataire, veillez à ne pas laisser le logement sans électricité ni chauffage.",
          "Pour les charges de copropriété, expliquez au locataire quelles provisions il devra régler, comment se passe la régularisation annuelle et quel est le calendrier. Un locataire qui comprend les charges dès l'entrée pose moins de questions lors de la régularisation.",
        ],
        bullets: [
          "Index eau froide, eau chaude, électricité, gaz relevés et signés.",
          "Numéro de point de livraison électricité (PDL) et gaz (PCE) transmis.",
          "Contact du gestionnaire de l'immeuble ou du syndic communiqué.",
          "Explication des provisions sur charges et du calendrier de régularisation.",
        ],
      },
      {
        title: "Installer une relation claire dès le départ",
        paragraphs: [
          "La remise des clés est aussi le moment d'établir des règles de fonctionnement claires. Expliquez comment envoyer une demande de réparation (par email, pas par SMS), quand le loyer est attendu (avant le 5 du mois, par exemple), comment la quittance sera fournie et comment signaler un problème technique.",
          "Choisissez un canal de communication traçable pour tous les échanges importants : email plutôt que téléphone ou SMS. Un email permet de dater les demandes, de prouver qu'elles ont été reçues et de retracer l'historique de la relation locative. Cela devient précieux en cas de litige.",
        ],
        bullets: [
          "Canal de contact principal : email (traçable, datée, archivable).",
          "Date limite de paiement du loyer communiquée par écrit.",
          "Processus de délivrance de quittance expliqué (délai, format).",
          "Procédure de signalement des réparations expliquée.",
          "Règles de copropriété rappelées brièvement.",
        ],
      },
      {
        title: "La quittance et le premier loyer",
        paragraphs: [
          "Le bailleur est obligé de délivrer une quittance au locataire qui en fait la demande. Vous pouvez la transmettre par email sous format PDF. La quittance doit mentionner le montant du loyer, les provisions sur charges, la période couverte et la mention que le locataire est à jour de ses paiements.",
          "Si le locataire entre en cours de mois, le premier loyer est proratisé au nombre de jours restants dans le mois. Par exemple, pour une entrée le 15 juin dans un logement à 900 €/mois : 900 € × (16 jours / 30 jours) = 480 €. Précisez le calcul dans le bail ou sur la première quittance pour éviter toute ambiguïté.",
          "Préparez un modèle de quittance mensuelle dès la signature du bail. Des outils de gestion locative en ligne génèrent automatiquement les quittances — même les plus simples suffisent si vous n'avez qu'un ou deux biens.",
        ],
        bullets: [
          "Quittance obligatoire à la demande du locataire (sans frais).",
          "Premier loyer proratisé si entrée en cours de mois.",
          "Modèle de quittance prêt dès la signature.",
          "Mentions obligatoires : loyer, charges, période, bailleur et locataire.",
        ],
      },
    ],
    checklist: [
      "Bail et annexes signés",
      "Attestation assurance habitation vérifiée",
      "DDT remis",
      "Inventaire meublé signé et photos jointes",
      "État des lieux d'entrée précis et signé",
      "Compteurs relevés et index noté dans l'état des lieux",
      "Photos envoyées au locataire par email",
      "Clés, badges et télécommandes comptés et remis",
      "Canal de contact et modalités de paiement expliqués",
      "Rappels de gestion créés (IRL, charges, assurance)",
    ],
    faq: [
      { q: "Peut-on remettre les clés sans l'attestation d'assurance habitation du locataire ?", a: "Vous n'êtes pas obligé de le faire : le bailleur a le droit de conditionner la remise des clés à la fourniture d'une attestation d'assurance couvrant les risques locatifs, obligation légale du locataire depuis l'article 7 de la loi du 6 juillet 1989. Mieux vaut vérifier ce document avant le rendez-vous plutôt que le jour même." },
      { q: "L'état des lieux d'entrée peut-il être fait sans la présence du locataire ?", a: "Ce n'est pas recommandé : un état des lieux non contradictoire (réalisé sans le locataire ni huissier) a une valeur probante bien plus faible en cas de litige. Si le locataire ne peut être présent, il est préférable de faire appel à un huissier de justice, dont les frais sont alors partagés entre les deux parties." },
      { q: "Comment calculer le premier loyer si le locataire entre en cours de mois ?", a: "Le loyer est proratisé au nombre de jours restants dans le mois. Exemple : pour une entrée le 15 juin dans un logement à 900 €/mois, le calcul est 900 € × (16 jours restants / 30 jours) = 480 €. Précisez ce calcul dans le bail ou sur la première quittance pour éviter toute ambiguïté." },
    ],
    sources: [
      { label: "ANIL : état des lieux d'entrée et de sortie", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/etat-des-lieux/" },
      { label: "Service-Public : obligations du propriétaire bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059" },
      { label: "Service-Public : quittance de loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1191" },
    ],
  },
  {
    slug: "travaux-reparations-bailleur-locataire",
    category: "gestion",
    title: "Travaux et réparations : qui paie entre le bailleur et le locataire ?",
    shortTitle: "Travaux et réparations",
    description: "Distinguer réparations locatives, vétusté et travaux à la charge du bailleur — avec des exemples concrets et la marche à suivre en cas de litige.",
    updatedAt: "2026-06-28",
    intro:
      "La frontière entre ce que doit payer le locataire et ce qui incombe au bailleur est précisément définie par la loi et le décret du 26 août 1987. Mais en pratique, chaque situation demande une analyse : un même problème peut relever de l'entretien courant, de la vétusté ou d'une dégradation selon son origine. Avant de répondre à un signalement, documentez le problème et qualifiez sa cause.",
    sections: [
      {
        title: "Le principe général : entretien courant vs maintien en état décent",
        paragraphs: [
          "Le locataire est tenu d'assurer l'entretien courant du logement et de prendre en charge les réparations locatives définies par le décret du 26 août 1987. Il doit rendre le logement dans l'état dans lequel il l'a pris, déduction faite de la vétusté normale.",
          "Le bailleur est tenu de maintenir le logement en état de servir à l'usage pour lequel il a été loué. Il doit prendre en charge les travaux qui ne sont pas des réparations locatives : gros travaux, remplacement d'équipements vétustes, mise aux normes, et réparations rendues nécessaires par la vétusté ou un vice de construction.",
          "En cas de désaccord, la question clé est : quel est l'origine du problème ? Une fuite d'un joint d'évier relève du locataire si c'est un joint d'usage courant. La même fuite relève du bailleur si elle est due à l'ancienneté de la robinetterie. La distinction n'est pas toujours évidente — un professionnel peut aider à trancher.",
        ],
      },
      {
        title: "Ce qui relève du locataire : les réparations locatives",
        paragraphs: [
          "Le décret du 26 août 1987 liste les réparations locatives à la charge du locataire. Il s'agit principalement de l'entretien courant et des menues réparations liées à l'usage normal du logement.",
        ],
        bullets: [
          "Plomberie : joints de robinets, flotteur de chasse d'eau, dégraissage des siphons.",
          "Chauffage : remplacement des piles du thermostat, purge des radiateurs, nettoyage annuel de la chaudière individuelle.",
          "Électricité : remplacement des ampoules, des prises et interrupteurs cassés (hors vétusté).",
          "Menuiserie : graissage des gonds et serrures, remplacement des joints de portes et fenêtres usés par l'usage.",
          "Sols : entretien des parquets (vitrification exclue si la dégradation précède l'entrée), nettoyage des carrelages.",
          "Jardins et extérieurs : tonte, taille, entretien des espaces verts privatifs.",
          "Menues réparations : remplacement des tablettes, tringles à rideaux, fixations légères.",
        ],
        note: "La liste du décret de 1987 n'est pas exhaustive. En cas de doute, le principe est : réparation légère liée à l'usage = locataire ; réparation importante ou due à la vétusté = bailleur.",
      },
      {
        title: "Ce qui relève du bailleur : décence et vétusté",
        paragraphs: [
          "Le bailleur doit maintenir le logement en état décent tout au long du bail. Il prend en charge les réparations importantes, les remplacements d'équipements vétustes et les travaux de mise aux normes. Il ne peut pas imputer ces coûts au locataire, même si la dégradation est apparue pendant la location.",
        ],
        bullets: [
          "Toiture, murs extérieurs et gros œuvre : étanchéité, infiltrations, fissures structurelles.",
          "Remplacement de la chaudière collective ou d'un chauffe-eau hors service par vétusté.",
          "Mise aux normes électrique ou gaz (remplacement complet d'une installation vétuste).",
          "Remplacement de fenêtres défectueuses (pas seulement les joints).",
          "Ravalement de façade et traitement des moisissures liés à un défaut d'étanchéité.",
          "Remplacement de la robinetterie complète si l'usure est due à l'ancienneté (pas à un usage abusif).",
          "Canalisations : remplacement en cas de fuite sur des tuyaux vétustes.",
        ],
      },
      {
        title: "La grille de vétusté : calculer la part imputable au locataire",
        paragraphs: [
          "La vétusté est la dépréciation normale d'un bien due au temps et à un usage standard. Le locataire ne peut pas être tenu de rembourser le coût total de remplacement d'un équipement qui avait déjà 10 ans lors de son départ. Une grille de vétusté (recommandée par la commission nationale de concertation) précise la durée de vie théorique de chaque équipement et le taux de vétusté applicable.",
          "Exemple : un parquet stratifié a une durée de vie théorique de 15 ans. Si le locataire l'a occupé pendant 5 ans, le parquet a déjà 33 % de vétusté. Si des dégradations nécessitent un remplacement à 600 €, la part imputable au locataire est de 600 € × (1 - 33 %) = 400 €. Les 200 € restants sont à la charge du bailleur.",
          "Appliquer la grille de vétusté protège le bailleur en cas de litige : une retenue justifiée par une grille officielle est beaucoup plus difficile à contester devant un tribunal qu'une retenue forfaitaire.",
        ],
        bullets: [
          "Peintures intérieures : durée de vie 7 ans environ.",
          "Moquette : durée de vie 7 ans environ.",
          "Parquet stratifié : durée de vie 15 ans environ.",
          "Électroménager (réfrigérateur, lave-linge) : durée de vie 10 ans environ.",
          "Robinetterie : durée de vie 15 à 20 ans.",
          "Chaudière individuelle : durée de vie 15 à 20 ans.",
        ],
      },
      {
        title: "La marche à suivre en cas de signalement",
        paragraphs: [
          "Quand un locataire signale un problème, répondez rapidement par écrit (email), même pour dire que vous prenez note. L'absence de réponse peut être interprétée comme une validation de la demande ou un manquement à vos obligations. Demandez des photos et une description précise avant d'intervenir.",
          "Évaluez l'urgence : une fuite d'eau active, une panne de chauffage en hiver ou une installation électrique défaillante appellent une intervention dans les 24 à 48 heures. Pour les problèmes moins urgents, un délai d'intervention de 2 à 4 semaines est raisonnable. Communiquez un délai estimé au locataire.",
          "Faites intervenir un professionnel pour qualifier le problème si son origine n'est pas évidente. La facture ou le rapport d'intervention précise souvent la cause (vétusté, usage abusif, vice de construction) et tranche la question de la responsabilité.",
        ],
        bullets: [
          "Répondre par écrit dans les 24 heures, même brièvement.",
          "Demander photos et description précise avant d'intervenir.",
          "Qualifier l'urgence : urgence immédiate (fuite, panne chauffage hiver) vs non-urgent.",
          "Faire appel à un professionnel pour les problèmes d'origine incertaine.",
          "Archiver : date du signalement, qualification du problème, décision, facture d'intervention.",
        ],
      },
      {
        title: "Les travaux d'amélioration en cours de bail",
        paragraphs: [
          "Le bailleur peut réaliser des travaux d'amélioration ou de mise en conformité en cours de bail, même sans accord du locataire. Mais il doit respecter un préavis écrit de 1 mois minimum et prendre en charge les frais de relogement provisoire si les travaux rendent le logement inhabitable.",
          "Si les travaux durent plus de 40 jours, le locataire peut demander une réduction de loyer proportionnelle à la durée et à la partie du logement inaccessible. Si les travaux sont particulièrement importants ou fréquents, le locataire peut donner son congé sans préavis.",
          "Les travaux réalisés par le locataire avec l'accord du bailleur peuvent donner lieu à une indemnisation au départ. Les travaux réalisés sans accord ne donnent droit à aucune indemnisation et peuvent être une source de litige sur l'état des lieux de sortie.",
        ],
        bullets: [
          "Préavis obligatoire : 1 mois avant le début des travaux.",
          "Travaux > 40 jours : réduction de loyer possible, proportionnelle.",
          "Travaux rendant le logement inhabitable : relogement à la charge du bailleur.",
          "Travaux par le locataire sans accord : pas d'indemnisation au départ.",
          "Travaux par le locataire avec accord écrit : indemnisation possible selon convention.",
        ],
      },
      {
        title: "Si le locataire refuse l'accès pour des travaux",
        paragraphs: [
          "Le locataire est tenu de laisser accès au logement pour les travaux d'entretien, d'amélioration des parties communes ou de mise aux normes. Il ne peut pas s'y opposer sans motif légitime. En cas de refus injustifié, le bailleur peut mettre le locataire en demeure par lettre recommandée avec accusé de réception.",
          "Si le locataire persiste, une saisine du juge des référés permet d'obtenir en urgence une autorisation d'accès sous astreinte. Cette procédure est rapide mais doit être réservée aux cas sérieux (travaux urgents de sécurité, par exemple). Consultez votre ADIL ou un avocat avant d'engager une procédure judiciaire.",
        ],
        bullets: [
          "Locataire tenu de laisser accès pour travaux d'entretien et d'amélioration.",
          "Refus injustifié : mise en demeure par lettre recommandée.",
          "Refus persistant : saisine du juge des référés possible.",
          "Garder une trace écrite de chaque demande d'accès et de chaque refus.",
        ],
        note: "Pour tout litige sur les travaux ou la répartition des réparations, votre ADIL (Agence Départementale d'Information sur le Logement) offre des conseils gratuits.",
      },
    ],
    faq: [
      { q: "Qui paie le remplacement d'une chaudière individuelle en panne ?", a: "Cela dépend de la cause. Si la panne résulte de l'usure normale ou de la vétusté de l'appareil (chaudière ayant dépassé sa durée de vie théorique de 15-20 ans), le remplacement est à la charge du bailleur. Si elle résulte d'un défaut d'entretien courant du locataire (absence d'entretien annuel obligatoire), la responsabilité peut lui incomber." },
      { q: "Comment calculer la part de vétusté à déduire d'une réparation ?", a: "Chaque équipement a une durée de vie théorique (peintures 7 ans, moquette 7 ans, parquet stratifié 15 ans, électroménager 10 ans). La part imputable au locataire diminue proportionnellement à la durée d'occupation. Exemple : un parquet de 15 ans de durée de vie théorique, occupé 5 ans, a 33 % de vétusté — sur un remplacement à 600 €, seuls 400 € (600 € × 67 %) sont imputables au locataire." },
      { q: "Le locataire peut-il refuser l'accès au logement pour des travaux ?", a: "Il ne peut pas s'y opposer sans motif légitime, le locataire étant tenu de laisser l'accès pour les travaux d'entretien et d'amélioration. En cas de refus injustifié et persistant, le bailleur peut mettre le locataire en demeure par lettre recommandée puis, si nécessaire, saisir le juge des référés pour obtenir une autorisation d'accès sous astreinte." },
    ],
    sources: [
      { label: "Service-Public : réparations locatives", href: "https://www.service-public.fr/particuliers/vosdroits/F31697" },
      { label: "Service-Public : travaux à la charge du bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/F31699" },
      { label: "ANIL : grille de vétusté et dépôt de garantie", href: "https://www.anil.org" },
    ],
  },
  {
    slug: "depart-locataire-etat-des-lieux-sortie",
    category: "depart",
    title: "Départ du locataire : du préavis à l'état des lieux de sortie",
    shortTitle: "Départ du locataire",
    description: "Organiser le congé, vérifier les délais de préavis, préparer l'état des lieux de sortie et calculer les retenues admissibles.",
    updatedAt: "2026-06-28",
    intro:
      "Un départ bien géré commence dès la réception du congé. Les décisions prises dans les premières heures — vérification du préavis, planification de l'état des lieux, gestion du dernier loyer — conditionnent la clôture du bail. Un état des lieux bâclé ou une retenue mal justifiée peut mener à un litige devant la commission de conciliation ou le tribunal judiciaire.",
    sections: [
      {
        title: "À la réception du congé",
        paragraphs: [
          "Le congé du locataire peut être donné par lettre recommandée avec accusé de réception, par acte d'huissier ou par remise en main propre contre récépissé. Le délai de préavis commence à courir à la date de réception du courrier — pas de sa rédaction ni de son envoi. Archivez l'enveloppe ou l'accusé de réception : la date de réception fait foi.",
          "Confirmez la date de fin de bail par écrit au locataire. Si le préavis est réduit (zone tendue, perte d'emploi, RSA, mutation professionnelle), demandez le justificatif correspondant. Un préavis réduit non justifié reste un préavis de 3 mois : vous n'êtes pas tenu d'accepter un départ anticipé sans motif valide.",
        ],
        bullets: [
          "Archiver le congé avec la date de réception (enveloppe ou accusé de réception).",
          "Vérifier le délai de préavis applicable (voir section suivante).",
          "Confirmer la date de fin de bail par écrit au locataire.",
          "Demander le justificatif si le locataire invoque un préavis réduit.",
          "Planifier l'état des lieux de sortie : proposer plusieurs créneaux rapidement.",
        ],
      },
      {
        title: "Les délais de préavis selon la situation",
        paragraphs: [
          "Le délai de préavis du locataire varie selon le type de bail et la localisation du logement. En location vide, le préavis est de 3 mois en principe, réduit à 1 mois dans plusieurs situations. En location meublée, le préavis est toujours d'1 mois, quelle que soit la localisation.",
          "Les situations permettant un préavis réduit à 1 mois en location vide : logement situé en zone tendue (liste définie par décret), perte d'emploi involontaire (licenciement, fin de mission d'intérim), premier emploi ou mutation professionnelle, attribution d'un logement social, état de santé justifiant un changement de domicile (avec certificat médical).",
        ],
        bullets: [
          "Location vide hors zone tendue : préavis locataire 3 mois.",
          "Location vide en zone tendue : préavis locataire 1 mois.",
          "Location vide, motifs spéciaux (perte emploi, RSA, mutation) : préavis 1 mois.",
          "Location meublée : préavis locataire toujours 1 mois.",
          "Bail mobilité et bail étudiant : pas de préavis (fin automatique à l'échéance).",
          "Préavis bailleur : 6 mois en vide, 3 mois en meublé, avant l'échéance du bail.",
        ],
      },
      {
        title: "Gérer le dernier mois de location",
        paragraphs: [
          "Pendant le préavis, le locataire reste redevable du loyer jusqu'à la date officielle de fin de bail, même s'il quitte les lieux avant. Il ne peut pas imputer le dépôt de garantie en paiement du dernier loyer : le dépôt est une garantie, pas un pré-paiement. Si le locataire demande à partir avant la date de fin de bail, un avenant ou un accord écrit est nécessaire.",
          "Si le logement se reloue avant la fin du préavis, le locataire est exonéré du loyer à partir du jour où le nouveau locataire entre dans les lieux. Vérifiez l'arrêté municipal ou préfectoral applicable si vous êtes en zone tendue — certaines communes ont des règles supplémentaires.",
          "Profitez du dernier mois pour estimer les travaux nécessaires, prendre rendez-vous avec des artisans si des réparations importantes sont attendues, et actualiser l'annonce de relocation. Un logement remis en location rapidement minimise la vacance locative.",
        ],
        bullets: [
          "Loyer dû jusqu'à la date officielle de fin de bail, même si le locataire part avant.",
          "Dépôt de garantie non imputable sur le dernier loyer.",
          "Relocation anticipée : accord écrit nécessaire, loyer proratisé.",
          "Préparer les travaux de remise en état avant l'état des lieux si possible.",
          "Annonce de relocation à préparer dès la réception du congé.",
        ],
      },
      {
        title: "Préparer et réaliser l'état des lieux de sortie",
        paragraphs: [
          "L'état des lieux de sortie doit être réalisé le jour de la restitution des clés, en présence du locataire. Si le locataire est absent, vous pouvez faire appel à un huissier de justice — les frais seront partagés. Ne réalisez pas l'état des lieux sans le locataire ni sans huissier : un document non contradictoire a peu de valeur probante.",
          "Reprenez l'état des lieux d'entrée et comparez pièce par pièce. Relevez les écarts entre l'état d'entrée et l'état de sortie. Distinguez soigneusement : les dégradations imputables au locataire (traces, trous, brûlures, casses), l'usure normale (peintures légèrement ternies après 3 ans, joints de salle de bain blanchis) et la vétusté (équipement amorti par le temps, indépendamment du locataire).",
          "Relevez à nouveau les compteurs et notez les index dans l'état des lieux de sortie. Récupérez l'ensemble des clés, badges et télécommandes, et notez leur nombre. Si le locataire a perdu une clé, le coût du remplacement ou du changement de serrure peut être retenu.",
        ],
        bullets: [
          "Réalisé le jour de la restitution des clés, en présence du locataire.",
          "Comparaison pièce par pièce avec l'état des lieux d'entrée et les photos.",
          "Distinction entre dégradations, usure normale et vétusté.",
          "Compteurs relevés et index notés.",
          "Toutes les clés, badges et télécommandes récupérés et comptés.",
          "Photos des écarts constatés prises en présence du locataire.",
        ],
      },
      {
        title: "Calculer les retenues admissibles",
        paragraphs: [
          "Une retenue sur dépôt de garantie n'est valable que si elle est justifiée par un écart documenté entre l'état des lieux d'entrée et de sortie, non imputable à la vétusté ou à l'usure normale. Appliquez la grille de vétusté pour calculer la part réellement imputable au locataire (voir le guide sur les travaux et réparations).",
          "Chaque retenue doit être accompagnée d'un justificatif : facture d'artisan, devis, ou à défaut, estimation chiffrée motivée. Les justificatifs doivent être transmis au locataire avec le décompte. Une retenue sans justificatif peut être annulée par le tribunal judiciaire.",
          "Vous pouvez également retenir les loyers impayés, les charges non réglées et le coût de la remise des clés à un huissier si le locataire s'y est soustrait. Le montant total des retenues ne peut pas dépasser le montant du dépôt de garantie — les sommes supérieures doivent être réclamées par voie judiciaire.",
        ],
        bullets: [
          "Retenue admissible : écart documenté dans l'état des lieux, non dû à la vétusté.",
          "Justificatif obligatoire pour chaque retenue (facture ou devis).",
          "Appliquer la grille de vétusté pour le calcul de la part imputable.",
          "Loyers et charges impayés : retenus sur le dépôt, solde réclamable judiciairement.",
          "Clés non restituées : coût de remplacement de serrure retenu.",
        ],
      },
      {
        title: "Clôturer le bail et préparer la relocation",
        paragraphs: [
          "Après l'état des lieux, préparez un récapitulatif clair séparant : solde locatif (dernier loyer et charges), décompte des retenues sur dépôt de garantie avec justificatifs, et solde à restituer ou à réclamer. Envoyez ce document au locataire par email ou lettre recommandée dans le délai légal de restitution du dépôt (1 ou 2 mois selon la situation).",
          "Archivez le bail clos avec tous les documents de la relation locative : bail, avenants, états des lieux, quittances, échanges significatifs et décompte final. Ces documents peuvent être utiles 3 ans encore après la fin du bail (délai de prescription pour les litiges locatifs).",
        ],
        bullets: [
          "Récapitulatif transmis par email ou LRAR avec les justificatifs.",
          "Bail archivé avec tous les documents (délai de conservation : 3 ans minimum).",
          "Annonce de relocation à actualiser avec le DPE et les diagnostics valides.",
          "Travaux de remise en état planifiés et réalisés avant la nouvelle mise en location.",
        ],
      },
    ],
    checklist: [
      "Congé archivé avec date de réception",
      "Délai de préavis vérifié",
      "Justificatif de préavis réduit demandé si applicable",
      "Date de fin de bail confirmée par écrit",
      "État des lieux d'entrée ressorti pour comparaison",
      "État des lieux de sortie réalisé en présence du locataire",
      "Compteurs relevés et notés",
      "Toutes les clés récupérées",
      "Retenues calculées avec grille de vétusté et justificatifs",
      "Décompte transmis dans les délais",
      "Bail archivé",
    ],
    faq: [
      { q: "À partir de quand court le délai de préavis du locataire ?", a: "À compter de la date de réception du congé, pas de sa date de rédaction ou d'envoi. Conservez l'accusé de réception ou l'enveloppe : c'est cette date qui fait foi pour calculer la fin du bail." },
      { q: "Le locataire peut-il imputer le dépôt de garantie sur son dernier loyer ?", a: "Non. Le dépôt de garantie est une garantie de fin de bail, pas un pré-paiement : le locataire reste redevable du loyer jusqu'à la date officielle de fin de bail, même s'il quitte les lieux avant cette date. S'il part avant l'échéance sans accord écrit sur une relocation anticipée, il doit continuer à payer." },
      { q: "Peut-on réaliser l'état des lieux de sortie sans le locataire présent ?", a: "Oui, mais uniquement en faisant appel à un huissier de justice (commissaire de justice), dont les frais sont partagés entre les deux parties. Un état des lieux réalisé unilatéralement, sans le locataire ni huissier, a une valeur probante très affaiblie en cas de contestation." },
    ],
    sources: [
      { label: "Service-Public : congé donné par le locataire", href: "https://www.service-public.fr/particuliers/vosdroits/F1168" },
      { label: "ANIL : état des lieux de sortie", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/etat-des-lieux/" },
      { label: "Service-Public : délais de préavis", href: "https://www.service-public.fr/particuliers/vosdroits/F929" },
    ],
  },
  {
    slug: "depot-garantie-restitution-retenues",
    category: "depart",
    title: "Dépôt de garantie : restituer, justifier et éviter les litiges",
    shortTitle: "Dépôt de garantie",
    description: "Montants légaux, délais de restitution, retenues admissibles, vétusté et pénalités en cas de retard — tout ce qu'un bailleur doit savoir.",
    updatedAt: "2026-06-28",
    intro:
      "Le dépôt de garantie est la source de litige la plus fréquente entre bailleurs et locataires. Il n'est ni un dernier loyer ni une réserve librement utilisable : c'est une garantie encadrée par la loi, avec des montants plafonnés, des délais de restitution stricts et des pénalités en cas de retard. Comprendre ces règles permet d'éviter les procédures inutiles et de sécuriser vos retenues légitimes.",
    sections: [
      {
        title: "Les montants légaux selon le type de bail",
        paragraphs: [
          "Le montant du dépôt de garantie est plafonné par la loi. En location vide, il est limité à 1 mois de loyer hors charges. En location meublée, il peut aller jusqu'à 2 mois de loyer hors charges. Le bail mobilité est particulier : aucun dépôt de garantie ne peut être exigé du locataire.",
          "Le dépôt doit être versé à la signature du bail, et sa réception doit être mentionnée dans le bail. Il ne peut pas être encaissé en cours de bail comme complément de loyer. Il ne peut pas non plus être utilisé par le locataire pour couvrir le dernier mois de loyer : ces situations constituent un manquement ouvrant droit à des pénalités.",
        ],
        bullets: [
          "Location vide : dépôt de garantie maximum 1 mois de loyer hors charges.",
          "Location meublée : dépôt de garantie maximum 2 mois de loyer hors charges.",
          "Bail mobilité : aucun dépôt de garantie autorisé.",
          "Versement : à la signature du bail (attestation à conserver).",
          "Usage du dépôt comme dernier loyer : interdit, motif de pénalité.",
        ],
      },
      {
        title: "Ce que le dépôt peut couvrir",
        paragraphs: [
          "Le dépôt de garantie peut être utilisé pour couvrir les loyers et charges impayés, les dégradations imputables au locataire (établies par comparaison des états des lieux d'entrée et de sortie), et les frais de remise en état documentés par des factures.",
          "Ce qu'il ne peut pas couvrir : les réparations locatives déjà effectuées par le locataire (qui doivent être attestées), les travaux de vétusté (à la charge du bailleur), l'usure normale des équipements, et les coûts non justifiés. Une retenue sans justificatif ou manifestement excessive peut être annulée par le tribunal.",
        ],
        bullets: [
          "Admissible : loyers et charges impayés, dégradations documentées, frais de remise en état avec factures.",
          "Non admissible : travaux de vétusté, usure normale, coûts non justifiés.",
          "Non admissible : nettoyage si le logement est rendu propre.",
          "Non admissible : remplacement d'équipements en fin de vie normale.",
        ],
      },
      {
        title: "Les délais de restitution et les pénalités",
        paragraphs: [
          "Le délai de restitution du dépôt de garantie dépend du résultat de l'état des lieux de sortie. Si l'état des lieux de sortie est conforme à l'état des lieux d'entrée (aucun écart), le dépôt doit être restitué dans un délai d'1 mois à compter de la remise des clés. Si des écarts sont constatés justifiant des retenues, le délai est de 2 mois.",
          "En cas de non-restitution dans les délais, des intérêts de retard s'appliquent automatiquement. Le montant du dépôt est majoré de 10 % par mois de retard entamé (soit 120 % par an). Ces intérêts s'appliquent de plein droit, sans que le locataire ait à les réclamer au préalable.",
          "Si le bailleur ne restitue pas le dépôt et ne répond pas aux mises en demeure, le locataire peut saisir la Commission Départementale de Conciliation (CDC, gratuite) puis le tribunal judiciaire. La procédure au tribunal est accessible sans avocat pour les montants inférieurs à 10 000 €.",
        ],
        bullets: [
          "État des lieux conforme : restitution dans 1 mois après remise des clés.",
          "Écarts constatés : restitution dans 2 mois après remise des clés.",
          "Retard de restitution : majoration de 10 % par mois de retard entamé.",
          "Recours du locataire : Commission Départementale de Conciliation (gratuit) puis tribunal judiciaire.",
          "Prescription des litiges locatifs : 3 ans à compter de la fin du bail.",
        ],
        note: "La date de référence pour le calcul du délai est la date de remise des clés, pas la date de l'état des lieux. Si le locataire remet les clés le 30 juin, le dépôt doit être restitué au plus tard le 31 juillet (1 mois) ou le 31 août (2 mois).",
      },
      {
        title: "Appliquer la grille de vétusté pour calculer les retenues",
        paragraphs: [
          "La grille de vétusté permet de calculer la part des coûts de remise en état réellement imputable au locataire, après déduction de l'usure normale due au temps. La Commission Nationale de Concertation (CNC) a publié une grille de référence, sans caractère obligatoire mais largement utilisée par les tribunaux comme guide d'équité.",
          "Le principe : chaque équipement a une durée de vie théorique. Si le locataire a occupé le logement pendant la moitié de cette durée de vie, l'équipement est amorti à 50 % — le locataire ne peut donc être tenu que de 50 % du coût de remplacement. Plus la durée d'occupation est longue, plus la part imputable au locataire diminue.",
          "Exemple pratique : une peinture intérieure a une durée de vie théorique de 7 ans. Si un locataire part après 4 ans d'occupation et que les murs nécessitent un rafraîchissement, la vétusté est de 57 % (4/7). Sur un devis de peinture de 700 €, la part imputable au locataire est 700 € × 43 % = 301 €. Le reste (399 €) est à la charge du bailleur.",
        ],
        bullets: [
          "Peintures : durée de vie 7 ans, vétusté linéaire.",
          "Moquette / revêtement sol souple : durée de vie 7 ans.",
          "Parquet stratifié : durée de vie 15 ans.",
          "Papier peint : durée de vie 10 ans.",
          "Faïence et carrelage : durée de vie 25 ans.",
          "Robinetterie et équipements sanitaires : durée de vie 15-20 ans.",
          "Électroménager (réfrigérateur, lave-linge) : durée de vie 10-12 ans.",
        ],
      },
      {
        title: "Justifier et clôturer proprement",
        paragraphs: [
          "Adressez au locataire un décompte détaillé mentionnant : le montant du dépôt encaissé, les loyers et charges éventuellement dus, chaque retenue pour dégradation avec son justificatif (devis ou facture d'artisan), la vétusté appliquée et le solde à restituer ou à réclamer. Ce document doit être transmis par email ou lettre recommandée.",
          "Conservez l'ensemble du dossier de fin de bail — états des lieux d'entrée et de sortie, photos, factures, décompte, accusé de réception — pendant 3 ans après la fin du bail. C'est le délai de prescription pour les litiges locatifs. Si le locataire conteste une retenue 2 ans après son départ, vous devez être en mesure de produire tous ces documents.",
          "Si le montant des dégradations dépasse le dépôt de garantie, vous pouvez réclamer le solde au locataire par lettre recommandée, puis saisir la Commission Départementale de Conciliation, et enfin le tribunal judiciaire si la conciliation échoue.",
        ],
        bullets: [
          "Décompte détaillé avec chaque retenue et son justificatif.",
          "Vétusté calculée et mentionnée pour chaque poste.",
          "Transmis par email ou LRAR dans le délai légal.",
          "Dossier complet archivé 3 ans après la fin du bail.",
          "Solde positif pour le bailleur : mise en demeure puis conciliation ou tribunal.",
        ],
      },
      {
        title: "Éviter les retenues fragiles",
        paragraphs: [
          "Une retenue fragile est une retenue que vous ne pourriez pas expliquer clairement si un juge vous posait la question. Avant de retenir une somme, vérifiez : cet écart est-il documenté dans les deux états des lieux ? Le justificatif (facture ou devis) couvre-t-il exactement ce poste ? La vétusté a-t-elle été appliquée ? La somme est-elle proportionnelle au préjudice réel ?",
          "Les retenues les plus contestées sont : le ménage (retenu alors que le logement était \"propre\"), la peinture complète après quelques mois d'occupation, le remplacement de mobilier vétuste après de nombreuses années. Ces situations finissent souvent en faveur du locataire devant la commission de conciliation.",
        ],
        bullets: [
          "Ne pas retenir si l'écart n'est pas clairement documenté dans l'état des lieux.",
          "Ne pas retenir pour de l'usure normale : peintures ternies après 5 ans, joints blanchis...",
          "Ne pas facturer le ménage si le logement est rendu dans un état de propreté correct.",
          "Ne pas retenir le remplacement complet d'un équipement vétuste sans appliquer la grille.",
          "Chaque retenue doit pouvoir être expliquée simplement et justifiée par un document.",
        ],
        note: "En cas de désaccord, la Commission Départementale de Conciliation (CDC) offre une médiation gratuite avant tout recours judiciaire. La saisine suspend le délai de prescription.",
      },
    ],
    checklist: [
      "Montant du dépôt conforme au type de bail (1 mois vide / 2 mois meublé)",
      "Versement documenté dans le bail",
      "États des lieux d'entrée et de sortie comparés",
      "Écarts documentés avec photos",
      "Grille de vétusté appliquée",
      "Justificatifs (factures/devis) rassemblés",
      "Décompte détaillé préparé",
      "Délai de restitution respecté (1 ou 2 mois)",
      "Décompte transmis par email ou LRAR",
      "Dossier archivé (3 ans minimum)",
    ],
    faq: [
      { q: "Quel est le délai légal pour restituer le dépôt de garantie ?", a: "1 mois à compter de la remise des clés si l'état des lieux de sortie est conforme à celui d'entrée (aucun écart constaté), ou 2 mois si des retenues sont justifiées par des écarts documentés. La date de référence est celle de la remise des clés, pas celle de l'état des lieux." },
      { q: "Que risque un bailleur qui restitue le dépôt en retard ?", a: "Le dépôt est majoré automatiquement de 10 % du loyer mensuel par mois de retard entamé (soit 120 % par an), sans que le locataire ait à le réclamer. Passé ce stade, le locataire peut saisir gratuitement la Commission Départementale de Conciliation, puis le tribunal judiciaire." },
      { q: "Peut-on retenir le coût du ménage sur le dépôt de garantie ?", a: "Seulement si le logement n'est manifestement pas rendu dans un état de propreté normal. Facturer un ménage systématique alors que le logement est rendu propre est l'une des retenues les plus fréquemment contestées et annulées par la Commission Départementale de Conciliation." },
    ],
    sources: [
      { label: "Service-Public : dépôt de garantie", href: "https://www.service-public.fr/particuliers/vosdroits/F31269" },
      { label: "ANIL : restitution du dépôt de garantie", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/depot-de-garantie/" },
      { label: "Commission Nationale de Concertation : grille de vétusté", href: "https://www.anil.org" },
    ],
  },
  // ── GESTION : Quittances & révision IRL ──────────────────────────────────
  {
    slug: "quittances-revision-irl",
    category: "gestion",
    title: "Quittances, révision IRL et gestion mensuelle du loyer",
    shortTitle: "Quittances et révision IRL",
    description: "Délivrer des quittances conformes, appliquer la révision IRL à la bonne date et conserver une traçabilité irréprochable des paiements.",
    updatedAt: "2026-07-08",
    intro:
      "Chaque mois, le bailleur doit encaisser le loyer, délivrer une quittance si le locataire la demande, et préparer la révision annuelle à la date anniversaire du bail. Ces tâches paraissent simples mais recèlent des pièges : mention manquante sur la quittance, révision oubliée pendant 2 ans, revalorisation impossible à régulariser rétroactivement, preuve de paiement absente en cas de litige. Ce guide couvre chaque étape de la gestion mensuelle.",
    sections: [
      {
        title: "1. La quittance : obligation et contenu",
        paragraphs: [
          "Le bailleur est légalement tenu de délivrer une quittance au locataire qui en fait la demande, et ce gratuitement. L'envoi peut se faire par email (PDF) — un simple modèle Word ou un outil de gestion locative suffit. Refuser de délivrer une quittance ou la faire payer constitue un manquement susceptible d'être invoqué par le locataire.",
          "La quittance n'est pas obligatoire si le locataire ne la réclame pas, mais c'est une bonne pratique de l'émettre systématiquement. En cas de litige futur sur les paiements, les quittances constituent une preuve unilatérale de bonne foi — elles ne font pas foi absolue, mais renforcent considérablement votre position.",
        ],
        bullets: [
          "Mention obligatoire : nom et adresse du bailleur, nom du locataire, adresse du logement.",
          "Montant du loyer hors charges, montant des provisions sur charges, total.",
          "Période couverte (ex. : 'loyer du 1er juillet au 31 juillet 2026').",
          "Mention que le locataire est à jour de ses paiements.",
          "Date d'émission et signature du bailleur.",
          "Format PDF transmis par email : preuve de remise datée et archivable.",
        ],
        note: "Si le locataire a payé partiellement, délivrez un reçu de paiement partiel (pas une quittance). La quittance atteste d'un paiement complet. Un reçu partiel protège le bailleur en cas de contestation.",
      },
      {
        title: "2. La révision IRL : principe et calcul",
        paragraphs: [
          "L'Indice de Référence des Loyers (IRL) est publié chaque trimestre par l'INSEE. Il sert à plafonner l'augmentation annuelle du loyer. Le bail doit comporter une clause de révision pour que la révision soit possible — sans cette clause, le loyer est gelé pendant toute la durée du bail.",
          "La formule est : Nouveau loyer = Loyer actuel × (IRL du trimestre de référence actuel / IRL du même trimestre de l'année précédente). Le trimestre de référence est celui mentionné dans le bail — souvent le dernier IRL connu à la date de signature. Si rien n'est précisé, le trimestre de la signature du bail fait foi.",
          "Exemple : loyer actuel 850 €, IRL T1 2026 = 145,47, IRL T1 2025 = 140,18. Nouveau loyer = 850 × (145,47 / 140,18) = 850 × 1,0377 = 882,05 € → arrondi à 882 €.",
        ],
        bullets: [
          "IRL publié chaque trimestre par l'INSEE (résultats disponibles ~45 jours après la fin du trimestre).",
          "Clause de révision obligatoire dans le bail pour pouvoir augmenter.",
          "Formule : loyer actuel × (IRL n / IRL n-1).",
          "Augmentation plafonnée à l'IRL : toute clause permettant une hausse supérieure est nulle.",
          "En zone encadrée des loyers : la révision IRL s'applique, mais ne peut pas dépasser le loyer de référence majoré.",
        ],
      },
      {
        title: "3. Quand et comment appliquer la révision",
        paragraphs: [
          "La révision s'applique à la date anniversaire du bail, une fois par an. Si le bail a été signé le 1er septembre 2024, la première révision possible est le 1er septembre 2025. Le bailleur doit informer le locataire du nouveau loyer par écrit (email suffit) avant la date de révision.",
          "Si vous oubliez d'appliquer la révision à la date anniversaire, vous n'êtes pas en droit de la régulariser rétroactivement. Certains juristes estiment qu'une mise en demeure peut permettre une révision tardive, mais la jurisprudence est mitigée. La meilleure pratique : posez un rappel annuel et appliquez la révision à la bonne date.",
          "Pour les baux à loyer vide, la révision est optionnelle. Pour les baux meublés (BIC), elle est également optionnelle mais fortement conseillée pour maintenir la valeur réelle du loyer dans le temps. Sur 5 ans, une inflation de 3 %/an non répercutée représente une perte de plus de 15 % du loyer en valeur réelle.",
        ],
        bullets: [
          "Date anniversaire : à noter dès la signature du bail.",
          "Notification au locataire par email avant la date de révision.",
          "IRL à utiliser : dernier IRL publié à la date de révision.",
          "Révision oubliée : non rétroactivement récupérable (sauf accord du locataire ou mise en demeure contestée).",
          "Nouveau loyer arrondi à l'euro le plus proche (usage courant).",
          "Avenant au bail recommandé pour acter le nouveau montant.",
        ],
        note: "Vous n'êtes pas obligé d'appliquer la révision IRL dans sa totalité. Vous pouvez ne pas réviser ou réviser à la hausse dans la limite de l'IRL. Réviser en dessous de l'IRL est autorisé — certains bailleurs font ce choix pour fidéliser un bon locataire.",
      },
      {
        title: "4. Traçabilité des paiements et gestion des retards",
        paragraphs: [
          "Archivez chaque paiement de loyer avec la date, le montant et le mode de règlement. En cas de litige sur un impayé prétendu, vous devrez prouver que tel mois a bien été encaissé. Un simple tableau Excel ou un outil de gestion locative fait l'affaire, à condition d'être tenu à jour.",
          "Pour les retards de quelques jours, un email de rappel bienveillant suffit dans un premier temps. Conservez l'email envoyé et la réponse : cet échange constitue une trace de la situation. Si le retard se répète ou s'allonge, formalisez rapidement (voir le guide sur les loyers impayés).",
          "La date de paiement convenue dans le bail est contractuelle. Si le locataire paie systématiquement en retard, vous pouvez rappeler par écrit la date contractuelle. La tolérance répétée sans réaction écrite peut être interprétée comme une acceptation tacite du nouveau mode de paiement.",
        ],
        bullets: [
          "Journal des paiements : date d'encaissement, montant, référence du virement.",
          "Retard ponctuel : email de rappel conservé.",
          "Retard répété : formaliser rapidement par email ou courrier.",
          "Ne jamais tolérer silencieusement un retard systématique sans en laisser une trace écrite.",
          "Mode de paiement : virement bancaire recommandé pour la traçabilité (éviter le chèque ou le cash).",
        ],
      },
      {
        title: "5. Comment lokt vous aide",
        paragraphs: [
          "lokt génère automatiquement les quittances PDF chaque mois pour chaque logement, avec toutes les mentions légales pré-remplies. Il vous suffit de confirmer le paiement — la quittance est prête à envoyer au locataire en un clic, sans ressaisie.",
          "L'espace bailleur lokt intègre un rappel de révision IRL à la date anniversaire de chaque bail. Vous recevez une alerte avec le calcul du nouveau loyer pré-calculé, le trimestre IRL applicable et le montant arrondi. Il n'y a plus d'IRL à chercher ni de formule à appliquer manuellement.",
          "L'historique des paiements est centralisé dans lokt : date d'encaissement, quittances émises, mois en retard signalés en rouge. En cas de litige, vous exportez l'historique complet en PDF en quelques secondes.",
        ],
        bullets: [
          "Quittances PDF générées automatiquement chaque mois, conformes aux mentions légales.",
          "Rappel de révision IRL à la date anniversaire avec calcul pré-rempli.",
          "Historique des paiements centralisé et exportable.",
          "Alertes de retard de paiement dès J+1 après la date d'échéance.",
          "Accès depuis mobile : confirmer un paiement et envoyer la quittance en 30 secondes.",
        ],
      },
    ],
    checklist: [
      "Clause de révision IRL présente dans le bail",
      "Date anniversaire de révision notée",
      "IRL applicable identifié chaque année",
      "Nouveau loyer calculé et notifié avant la date de révision",
      "Avenant ou email d'information envoyé au locataire",
      "Paiements archivés mois par mois",
      "Quittances émises avec toutes les mentions légales",
      "Retards formalisés par email",
    ],
    faq: [
      { q: "Peut-on appliquer la révision IRL rétroactivement si on l'a oubliée l'année dernière ?", a: "Non, la révision oubliée à sa date anniversaire n'est en principe pas récupérable rétroactivement — la jurisprudence sur ce point reste mitigée. La meilleure pratique est de poser un rappel annuel à la date anniversaire du bail plutôt que de compter sur une régularisation ultérieure." },
      { q: "Est-on obligé de délivrer une quittance chaque mois ?", a: "La quittance n'est obligatoire que si le locataire la demande, mais elle doit alors être délivrée gratuitement — la facturer est un manquement. En pratique, l'émettre systématiquement chaque mois est une bonne pratique : elle sert de preuve de bonne foi en cas de litige ultérieur sur les paiements." },
      { q: "Comment calculer la révision IRL d'un loyer ?", a: "La formule est : nouveau loyer = loyer actuel × (IRL du trimestre de référence actuel / IRL du même trimestre de l'année précédente). Exemple : loyer à 850 €, IRL T1 2026 = 145,47, IRL T1 2025 = 140,18 → nouveau loyer = 850 × (145,47/140,18) ≈ 882 €. Le bail doit comporter une clause de révision, sinon le loyer reste gelé toute la durée du contrat." },
    ],
    sources: [
      { label: "INSEE : Indice de Référence des Loyers (IRL)", href: "https://www.insee.fr/fr/statistiques/serie/001515333" },
      { label: "Service-Public : révision du loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1215" },
      { label: "Service-Public : quittance de loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1191" },
    ],
  },
  // ── GESTION : Charges locatives & régularisation ─────────────────────────
  {
    slug: "charges-regularisation-annuelle",
    category: "gestion",
    title: "Charges locatives 2026 : liste et régularisation annuelle",
    shortTitle: "Charges et régularisation",
    description: "Provisions vs forfait, liste des charges récupérables, calcul de la régularisation annuelle et délais légaux pour éviter tout litige.",
    updatedAt: "2026-07-08",
    intro:
      "Les charges locatives sont la deuxième source de litige entre bailleurs et locataires, juste derrière le dépôt de garantie. Le bailleur peut récupérer certaines dépenses sur le locataire — mais uniquement celles listées par le décret 87-713 — et doit en justifier le montant chaque année. Une régularisation mal calculée, tardive ou non justifiée peut être contestée et annulée. Ce guide couvre le bon mode de gestion des charges, le calcul de la régularisation et les pièges à éviter.",
    sections: [
      {
        title: "1. Provisions vs forfait : choisir le bon mode",
        paragraphs: [
          "En location vide, les charges sont obligatoirement gérées par provisions avec régularisation annuelle. Vous fixez un montant mensuel de provisions estimé, et vous le régularisez chaque année en fonction des charges réelles. Le forfait charges est interdit en location vide.",
          "En location meublée, vous avez le choix entre provisions avec régularisation (comme en vide) ou forfait charges. Le forfait est un montant fixe mensuel, non régularisé. Il est plus simple à gérer, mais vous devez estimer correctement les charges à la hausse : si les charges réelles sont supérieures au forfait, vous ne pouvez pas réclamer de complément.",
          "Le choix entre provisions et forfait en meublé doit être fait dès la signature du bail et mentionné dans le contrat. Vous ne pouvez pas changer de mode en cours de bail sans avenant.",
        ],
        bullets: [
          "Location vide : provisions avec régularisation obligatoires. Forfait interdit.",
          "Location meublée : provisions avec régularisation ou forfait (au choix, à mentionner dans le bail).",
          "Forfait : pratique mais risqué si charges sous-estimées — pas de rattrapage possible.",
          "Provisions : plus précises, mais impliquent une régularisation annuelle rigoureuse.",
        ],
      },
      {
        title: "2. Les charges récupérables : ce que vous pouvez facturer",
        paragraphs: [
          "Le décret du 26 août 1987 (n° 87-713) liste de façon limitative les charges récupérables sur le locataire. Tout ce qui ne figure pas dans cette liste est à la charge définitive du bailleur, même si vous l'avez payé. Facturer une charge non récupérable expose le bailleur à devoir rembourser les sommes perçues.",
          "Les principales charges récupérables concernent les parties communes (eau froide, eau chaude, entretien, électricité), les équipements collectifs (ascenseur, chauffage collectif, interphone) et les espaces extérieurs (gardiennage, espaces verts, voirie). Certaines taxes sont également récupérables : la taxe d'enlèvement des ordures ménagères (TEOM) est récupérable en totalité.",
        ],
        bullets: [
          "Eau froide et eau chaude des parties communes et du logement (si compteur individuel).",
          "Électricité des parties communes et équipements collectifs.",
          "Chauffage collectif : combustible, maintenance, exploitation.",
          "Ascenseur : électricité, contrat d'entretien et petites réparations.",
          "Taxe d'enlèvement des ordures ménagères (TEOM).",
          "Gardiennage (si le gardien assure effectivement des tâches d'entretien).",
          "Entretien des parties communes (ménage, produits, main d'œuvre).",
          "Espaces verts : entretien courant, arrosage.",
        ],
        note: "Consultez le décret 87-713 ou l'article de blog lokt sur les charges récupérables pour la liste complète. En cas de doute, un charge non listée = charge bailleur.",
      },
      {
        title: "3. Calculer la régularisation annuelle",
        paragraphs: [
          "La régularisation consiste à comparer les provisions encaissées sur l'année avec les charges réelles payées. Si les provisions excèdent les charges réelles, vous devez rembourser le trop-perçu au locataire. Si les charges réelles dépassent les provisions, vous avez le droit de réclamer le complément.",
          "Pour une copropriété, la base de calcul est le décompte annuel des charges de copropriété établi par le syndic, ventilé entre charges récupérables et charges non récupérables (les charges de gestion et d'administration restent à la charge du bailleur). Pour un logement individuel (maison, eau individuelle), la base est le montant des factures réelles de l'année.",
          "Exemple simple : provisions mensuelles = 80 €, soit 960 € sur 12 mois. Charges récupérables réelles selon le décompte de copropriété = 1 120 €. Régularisation = 1 120 - 960 = 160 € à réclamer au locataire. Si les charges réelles avaient été 820 €, vous auriez dû rembourser 140 €.",
        ],
        bullets: [
          "Base de calcul en copropriété : décompte annuel du syndic (charges récupérables uniquement).",
          "Base de calcul logement individuel : factures réelles (eau, ordures, entretien).",
          "Régularisation = charges réelles − provisions versées.",
          "Trop-perçu : à rembourser au locataire dans le délai convenu (ou immédiatement).",
          "Complément : à réclamer par écrit avec pièces justificatives.",
          "Ajuster les provisions pour l'année suivante après régularisation.",
        ],
      },
      {
        title: "4. Délais, pièces justificatives et obligations légales",
        paragraphs: [
          "La régularisation doit avoir lieu au moins une fois par an, dans le mois suivant la clôture du compte de charges de copropriété (généralement entre mars et juillet selon les exercices). Vous n'avez pas l'obligation d'effectuer la régularisation à une date précise — mais un retard excessif peut être interprété comme une renonciation tacite au complément.",
          "Vous devez transmettre au locataire le décompte des charges (ou les factures pour un logement individuel) au moins un mois avant la date de régularisation pour lui permettre de vérifier. Ces pièces doivent être tenues à disposition du locataire pendant 6 mois après l'envoi du décompte.",
          "Un locataire peut demander une copie des justificatifs à tout moment pendant cette période de 6 mois. Refuser de les communiquer vous expose à une contestation de la régularisation. Conservez les originaux (ou les copies scannées) pendant toute la durée du bail.",
        ],
        bullets: [
          "Régularisation : au moins une fois par an.",
          "Décompte à transmettre : au moins 1 mois avant la régularisation.",
          "Justificatifs à conserver disponibles : 6 mois après envoi du décompte.",
          "Ajustement des provisions pour l'année suivante recommandé après chaque régularisation.",
          "En copropriété : attendre le décompte définitif du syndic avant de régulariser.",
        ],
        note: "Pour les baux meublés en forfait charges, aucune régularisation n'est due ni possible. Si les charges réelles dépassent le forfait, le bailleur ne peut rien réclamer — et si elles sont inférieures, il n'a rien à rembourser. Cette règle rend le forfait risqué si vous avez sous-estimé les charges au départ.",
      },
      {
        title: "5. Erreurs fréquentes et litiges à éviter",
        paragraphs: [
          "Les erreurs les plus courantes : inclure des charges non récupérables (frais de gestion de l'agence, honoraires du syndic, assurance de l'immeuble, gros travaux), ne pas transmettre les justificatifs, régulariser trop tardivement, ou confondre les charges de l'exercice avec les appels de fonds provisionnels.",
          "Un locataire qui reçoit un complément de charges sans justificatifs est en droit de le contester. La Commission Départementale de Conciliation (CDC) peut être saisie gratuitement. Si la régularisation n'est pas justifiée, elle sera annulée. En cas de régularisation abusive répétée, le locataire peut solliciter des dommages et intérêts.",
          "Si vous gérez plusieurs biens dans la même copropriété, la ventilation des charges entre les logements doit correspondre aux tantièmes de copropriété de chaque lot. Vous ne pouvez pas arbitrairement répartir les charges entre vos locataires.",
        ],
        bullets: [
          "Non récupérables : frais de gestion, assurance de l'immeuble, honoraires de syndic, gros travaux.",
          "Ne pas confondre appels de fonds provisionnels et charges réelles.",
          "Justificatifs obligatoires : factures, décompte de copropriété.",
          "Régularisation tardive : peut affaiblir votre position en cas de litige.",
          "Ventilation entre logements : respecter les tantièmes de copropriété.",
        ],
      },
      {
        title: "6. Comment lokt vous aide",
        paragraphs: [
          "lokt centralise le suivi des provisions sur charges pour chaque logement : vous enregistrez les provisions mensuelles et les charges réelles au fur et à mesure. À l'échéance, l'espace bailleur calcule automatiquement la régularisation et génère le décompte à transmettre au locataire.",
          "L'historique des provisions et des régularisations est archivé dans lokt par logement. Vous pouvez retrouver en quelques secondes le décompte de charges des 3 dernières années — indispensable si un locataire conteste une régularisation après son départ.",
          "Pour les bailleurs LMNP au régime réel, lokt vous aide à distinguer les charges récupérables (refacturées au locataire) des charges déductibles fiscalement (toutes les charges effectives). Les deux colonnes sont exportables pour votre expert-comptable.",
        ],
        bullets: [
          "Suivi des provisions par logement : montants mensuels et total annuel.",
          "Calcul automatique de la régularisation avec décompte exportable.",
          "Archivage des justificatifs de charges par année et par logement.",
          "Export LMNP : distinction charges récupérables / charges fiscalement déductibles.",
          "Alerte de régularisation annuelle à la clôture de l'exercice de copropriété.",
        ],
      },
    ],
    checklist: [
      "Mode de charges choisi dans le bail (provisions ou forfait en meublé)",
      "Provisions mensuelles estimées correctement",
      "Décompte de copropriété ou factures rassemblés",
      "Charges récupérables identifiées (décret 87-713)",
      "Régularisation calculée : provisions vs charges réelles",
      "Décompte transmis au locataire avec justificatifs",
      "Délai légal respecté (1 mois avant régularisation)",
      "Provisions ajustées pour l'année suivante",
      "Justificatifs conservés 6 mois après envoi",
    ],
    faq: [
      { q: "Peut-on facturer un forfait charges en location vide ?", a: "Non, le forfait charges est interdit en location vide : les charges y sont obligatoirement gérées par provisions avec régularisation annuelle. Le forfait n'est possible qu'en location meublée, au choix, à mentionner dans le bail dès la signature." },
      { q: "Quelles charges ne peuvent jamais être refacturées au locataire ?", a: "Les frais de gestion (agence, comptabilité), les honoraires du syndic, l'assurance de l'immeuble et les gros travaux restent définitivement à la charge du bailleur, même s'il les a payés. Seules les charges listées de façon limitative par le décret 87-713 sont récupérables — en cas de doute, une charge non listée reste à la charge du bailleur." },
      { q: "Combien de temps avant la régularisation faut-il transmettre le décompte de charges au locataire ?", a: "Au moins 1 mois avant la date de régularisation, pour lui laisser le temps de vérifier. Les justificatifs (décompte de copropriété ou factures) doivent ensuite rester à sa disposition pendant 6 mois après l'envoi du décompte." },
    ],
    sources: [
      { label: "Légifrance : décret 87-713 (charges récupérables)", href: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000512060" },
      { label: "Service-Public : charges récupérables sur le locataire", href: "https://www.service-public.fr/particuliers/vosdroits/F947" },
      { label: "ANIL : régularisation des charges", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/" },
    ],
  },
  // ── GESTION : Loyers impayés ──────────────────────────────────────────────
  {
    slug: "loyers-impayes-procedure",
    category: "gestion",
    title: "Loyers impayés : du premier retard à la procédure judiciaire",
    shortTitle: "Loyers impayés",
    description: "Comment réagir dès le premier retard, formaliser la relance, activer la GLI, et lancer la procédure judiciaire si nécessaire — étape par étape.",
    updatedAt: "2026-07-08",
    intro:
      "Un loyer impayé doit déclencher une réaction rapide et formalisée. Plus vous attendez, plus la dette s'accumule et plus la procédure judiciaire est longue et coûteuse. La règle de base : relance amiable dès J+5, mise en demeure formelle à J+15, activation de la GLI ou contact du garant avant le mois suivant. Un bailleur organisé réduit considérablement le risque d'impayé structurel.",
    sections: [
      {
        title: "1. Identifier la nature du retard",
        paragraphs: [
          "Tous les retards ne sont pas équivalents. Un locataire habituellement fiable qui paie avec 5 jours de retard un mois n'appelle pas la même réponse qu'un locataire qui n'a pas payé depuis 3 semaines sans répondre aux appels. Avant d'agir, qualifiez la situation : impayé ponctuel (incident de paiement isolé), impayé tardif (retards répétés qui s'allongent) ou défaillance structurelle (arrêt des paiements, plus de contact).",
          "Vérifiez votre propre situation : le virement a-t-il été envoyé mais pas encore crédité ? Le locataire a-t-il indiqué un changement de RIB ou de banque ? Avant toute relance formelle, assurez-vous que le problème ne vient pas d'un délai bancaire ou d'une erreur de communication.",
        ],
        bullets: [
          "Impayé ponctuel (< 10 jours, premier incident) : relance email bienveillante.",
          "Retards répétés : formalisation immédiate, email de mise en alerte.",
          "Absence de paiement > 15 jours sans réponse : mise en demeure LRAR.",
          "Absence de paiement > 1 mois : activation GLI, contact garant, préparation procédure.",
          "Vérifier d'abord : virement en transit ? Changement de RIB non signalé ?",
        ],
      },
      {
        title: "2. La relance amiable : agir dès J+5",
        paragraphs: [
          "Dès le 5e jour suivant la date d'échéance contractuelle, envoyez un email de rappel simple et non accusateur. Un ton neutre et factuel est plus efficace qu'un ton agressif — l'objectif est d'obtenir le paiement, pas de déclencher un conflit. Mentionnez le montant dû, la date d'échéance et demandez une confirmation de paiement ou une explication.",
          "Conservez cet email et toutes les réponses. En cas de procédure ultérieure, cet historique documente votre démarche amiable préalable et renforce votre dossier. Un juge apprécie que le bailleur ait cherché à résoudre la situation à l'amiable avant de saisir le tribunal.",
          "Si le locataire répond avec une promesse de paiement à une date précise, confirmez-la par écrit et attendez. Si la date promise passe sans paiement, passez à l'étape suivante sans attendre davantage.",
        ],
        bullets: [
          "J+5 : email de relance simple, montant et date d'échéance rappelés.",
          "Ton neutre : 'Nous n'avons pas reçu votre règlement de juillet. Pouvez-vous nous confirmer ?'",
          "Conserver l'email envoyé + toute réponse du locataire.",
          "Promesse de paiement à une date → confirmer par écrit, patienter jusqu'à cette date.",
          "Date promise non tenue → passer à la mise en demeure sans délai supplémentaire.",
        ],
      },
      {
        title: "3. La mise en demeure formelle : J+15",
        paragraphs: [
          "Sans réponse ou sans paiement à J+15, envoyez une mise en demeure de payer par lettre recommandée avec accusé de réception (LRAR). Ce courrier marque le début de la procédure formelle. Il doit mentionner le montant total dû (loyer + charges + éventuels arriérés), la date limite de régularisation (généralement 8 jours), et la mention que faute de règlement, vous vous réservez le droit d'engager une procédure judiciaire.",
          "La mise en demeure n'est pas une obligation légale préalable à la procédure judiciaire, mais elle est fortement recommandée pour deux raisons : elle peut suffire à déclencher le paiement, et elle constitue une preuve irréfutable que le locataire a été informé de l'impayé avant toute procédure.",
          "Parallèlement, informez le garant (caution solidaire) de la situation par LRAR. Si vous avez souscrit une GLI, déclarez l'impayé à l'assureur dès ce stade — la plupart des contrats imposent une déclaration dans un délai précis (souvent 30 à 45 jours après l'impayé).",
        ],
        bullets: [
          "LRAR au locataire : montant dû, date limite, mention de procédure éventuelle.",
          "Délai de régularisation : 8 jours (usage), sans obligation légale d'un délai minimum.",
          "LRAR au garant (caution solidaire) simultanément.",
          "GLI : déclarer l'impayé à l'assureur dans le délai contractuel (vérifier votre contrat).",
          "Conserver l'accusé de réception du recommandé.",
        ],
        note: "Pour les baux d'habitation, la résiliation du bail pour impayé requiert une procédure judiciaire et une décision de justice. Vous ne pouvez pas changer la serrure, couper l'électricité ou l'eau, ni expulser vous-même le locataire — ces actes constituent un délit passible de poursuites pénales.",
      },
      {
        title: "4. Activer la GLI ou le garant",
        paragraphs: [
          "Si vous avez souscrit une garantie loyers impayés (GLI), déclarez l'impayé à l'assureur dès le premier mois de retard complet. Le délai de déclaration est précisé dans votre contrat — le dépasser peut entraîner la déchéance de la garantie. L'assureur vous indiquera les pièces à fournir (bail, état des loyers, mise en demeure) et le délai de prise en charge.",
          "Si vous avez opté pour une caution solidaire (garant personne physique), mettez-le en demeure de payer dès le premier impayé, par LRAR. La caution solidaire est immédiatement actionnable — vous n'avez pas à justifier d'une mise en demeure infructueuse du locataire au préalable (contrairement à la caution simple).",
          "Si vous utilisez Visale (Action Logement), déclarez l'impayé sur le portail Visale. Action Logement prend en charge les loyers impayés dans les conditions prévues par la convention et engage ensuite le recouvrement auprès du locataire.",
        ],
        bullets: [
          "GLI : déclarer dans le délai contractuel (souvent 30-45 jours), fournir bail + état des loyers + mise en demeure.",
          "Caution solidaire : LRAR au garant simultanément à la mise en demeure du locataire.",
          "Visale : déclaration sur le portail Action Logement, sans démarche judiciaire préalable.",
          "Conserver toutes les pièces transmises à l'assureur ou à Action Logement.",
        ],
      },
      {
        title: "5. La procédure judiciaire : commandement de payer",
        paragraphs: [
          "Si la mise en demeure reste sans effet, la procédure judiciaire commence par un commandement de payer, délivré par un commissaire de justice (anciennement huissier) au locataire. Ce document officiel donne au locataire 2 mois pour régler l'intégralité de la dette (loyers + charges + frais). Ce délai peut être allongé par le juge si le locataire sollicite des délais de paiement.",
          "Le commandement de payer est la première étape formelle vers la résiliation judiciaire du bail. Si la dette n'est pas réglée dans les 2 mois, vous pouvez saisir le tribunal judiciaire pour obtenir une ordonnance de résiliation du bail et, à terme, une autorisation d'expulsion. La procédure dure en moyenne 6 à 18 mois selon les juridictions.",
          "Les frais de procédure (commissaire de justice, avocat si nécessaire) sont en principe mis à la charge du locataire défaillant par le juge, mais leur recouvrement effectif n'est pas garanti si le locataire est insolvable.",
        ],
        bullets: [
          "Commandement de payer : délivré par commissaire de justice, délai 2 mois au locataire.",
          "Après 2 mois sans paiement : saisine du tribunal judiciaire.",
          "Jugement : résiliation du bail + titre exécutoire pour expulsion.",
          "Expulsion : uniquement sur ordonnance judiciaire + concours de la force publique.",
          "Délai moyen : 6 à 18 mois selon les juridictions (avec ou sans audience de conciliation).",
          "Trêve hivernale (1er novembre - 31 mars) : expulsions impossibles sauf exceptions.",
        ],
        note: "Ne coupez jamais l'électricité, l'eau ou le gaz pour forcer le départ du locataire. Ces actes constituent une 'voie de fait' passible de 3 ans d'emprisonnement et 30 000 € d'amende (article 226-4-2 du code pénal).",
      },
      {
        title: "6. Négocier un plan d'apurement",
        paragraphs: [
          "À n'importe quelle étape de la procédure, un locataire de bonne foi peut proposer un plan d'apurement : paiement de la dette par mensualités sur une période définie, en plus du loyer courant. Ce plan peut être accepté, mais formalisez-le impérativement par écrit (email signé ou avenant).",
          "Si un plan d'apurement est conclu, vérifiez scrupuleusement chaque échéance. Le non-respect d'une seule mensualité doit déclencher une relance immédiate. Un plan d'apurement mal suivi peut vous faire perdre des mois supplémentaires.",
          "En cas de jugement déjà prononcé, le locataire peut demander des délais de paiement au juge de l'exécution. Le juge peut accorder jusqu'à 36 mois de délais. Pendant ce délai, l'expulsion est suspendue mais le locataire doit payer son loyer courant et respecter les échéances de l'apurement.",
        ],
        bullets: [
          "Plan d'apurement : formaliser par écrit (email signé ou avenant au bail).",
          "Préciser les montants et dates de chaque versement.",
          "Non-respect d'une mensualité → relance écrite immédiate.",
          "Plan d'apurement + loyer courant : les deux doivent être honorés.",
          "Délais accordés par le juge : jusqu'à 36 mois, suspension d'expulsion.",
        ],
      },
      {
        title: "7. Comment lokt vous aide",
        paragraphs: [
          "lokt signale automatiquement tout loyer non encaissé dès le lendemain de la date d'échéance. Vous recevez une alerte sur votre espace bailleur (et par email si configuré), sans avoir à vérifier manuellement chaque mois que le virement est arrivé.",
          "L'historique des paiements de chaque locataire est centralisé dans lokt : vous voyez d'un coup d'œil les mois payés, les retards et les impayés. En cas de procédure, vous exportez l'état complet des loyers (montants, dates, manquants) en PDF en quelques secondes — le document type attendu par les assureurs GLI et les commissaires de justice.",
          "Pour les bailleurs avec plusieurs logements, lokt consolide les alertes impayés dans un tableau de bord unique. Plus besoin de surveiller plusieurs comptes bancaires ou tableaux Excel : un seul écran suffit pour voir l'état de chaque logement.",
        ],
        bullets: [
          "Alerte automatique de loyer non encaissé dès J+1 après l'échéance.",
          "Historique des paiements par locataire, exportable en PDF pour la GLI ou le commissaire de justice.",
          "Tableau de bord consolidé : état des paiements de tous les logements en un seul écran.",
          "Archivage des échanges et mises en demeure dans le dossier locataire.",
          "Rappel de trêve hivernale : alerte en octobre pour anticiper les procédures.",
        ],
      },
    ],
    checklist: [
      "Date d'échéance du loyer vérifiée",
      "Relance email amiable à J+5",
      "Mise en demeure LRAR à J+15",
      "Garant informé par LRAR simultanément",
      "GLI déclarée dans le délai contractuel",
      "Commandement de payer via commissaire de justice si pas de règlement à J+60",
      "Plan d'apurement formalisé par écrit si accord amiable",
      "Historique des paiements archivé",
      "Trêve hivernale vérifiée avant toute procédure d'expulsion",
    ],
    faq: [
      { q: "Peut-on couper l'électricité ou l'eau pour faire partir un locataire qui ne paie plus ?", a: "Non, jamais. Couper l'électricité, l'eau ou le gaz, changer la serrure ou expulser soi-même le locataire constitue une 'voie de fait', un délit passible de 3 ans d'emprisonnement et 30 000 € d'amende (article 226-4-2 du code pénal). Seule une décision de justice suivie du concours de la force publique permet une expulsion légale." },
      { q: "Combien de temps dure une procédure d'expulsion pour impayés en France ?", a: "En moyenne 6 à 18 mois selon les juridictions, entre le commandement de payer (délai de 2 mois laissé au locataire), la saisine du tribunal judiciaire, le jugement de résiliation, et enfin l'expulsion effective — qui reste par ailleurs impossible pendant la trêve hivernale (1er novembre au 31 mars), sauf exceptions." },
      { q: "À quel moment faut-il déclarer un impayé à l'assurance GLI ou activer le garant ?", a: "Dès le premier mois de retard complet pour la GLI (le délai contractuel de déclaration, souvent 30 à 45 jours, est à vérifier dans votre contrat pour éviter la déchéance de garantie). Pour un garant en caution solidaire, la mise en demeure par lettre recommandée peut être envoyée immédiatement, sans attendre d'avoir mis en demeure le locataire au préalable." },
    ],
    sources: [
      { label: "Service-Public : loyer impayé et procédure d'expulsion", href: "https://www.service-public.fr/particuliers/vosdroits/F1169" },
      { label: "ANIL : impayés de loyer", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/impayes-de-loyer/" },
      { label: "Action Logement : garantie Visale", href: "https://www.visale.fr" },
    ],
  },
  // ── PRÉPARER : Fixer le loyer ─────────────────────────────────────────────
  {
    slug: "fixer-son-loyer",
    category: "preparer",
    title: "Fixer le loyer : zones tendues, encadrement et optimisation",
    shortTitle: "Fixer le loyer",
    description: "Comprendre l'encadrement des loyers, vérifier les loyers de référence, appliquer les règles de relocation et fixer un loyer attractif sans se sous-évaluer.",
    updatedAt: "2026-07-08",
    intro:
      "Le loyer initial est libre en principe, mais de nombreuses règles viennent l'encadrer selon la localisation, la situation du logement et le type de bail. En zone d'encadrement (Paris, Lyon, Bordeaux, Lille, Montpellier et d'autres communes), un loyer supérieur au plafond expose le bailleur à une mise en conformité forcée et au remboursement des trop-perçus. En zone tendue, la relocation est soumise à des règles strictes. Ce guide vous aide à fixer un loyer légal, bien positionné et défendable.",
    sections: [
      {
        title: "1. Loyer libre ou encadré : vérifier d'abord",
        paragraphs: [
          "En dehors des zones d'encadrement, le loyer initial est librement fixé par le bailleur. La seule contrainte légale est la décence du logement et le respect des règles de relocation en zone tendue. Dans ce cas, référez-vous au marché local pour estimer un loyer compétitif : sites d'annonces, observatoires locaux des loyers (OLL), données de votre ADIL.",
          "Dans les communes soumises à l'encadrement des loyers, le loyer est plafonné par un loyer de référence majoré défini par arrêté préfectoral. Ce plafond varie selon le type de bien (vide ou meublé), le nombre de pièces, la période de construction et le quartier ou l'arrondissement. Dépasser ce plafond expose à une mise en conformité forcée, au remboursement du trop-perçu et potentiellement à une amende.",
          "La liste des communes en encadrement des loyers évolue chaque année. En 2026, les villes principales concernées sont Paris (depuis 2019), Lille (depuis 2020), Lyon et Villeurbanne (depuis 2021), Bordeaux (depuis 2022), Montpellier (depuis 2022). D'autres communes ont rejoint ou vont rejoindre le dispositif — vérifiez la situation de votre commune avant toute mise en location.",
        ],
        bullets: [
          "Communes en encadrement des loyers (2026) : Paris, Lille, Lyon, Villeurbanne, Bordeaux, Montpellier, et d'autres.",
          "Loyer de référence majoré : plafond à ne pas dépasser.",
          "Loyer de référence minoré : plancher en dessous duquel le locataire peut demander une baisse.",
          "Vérification en ligne : via les portails officiels de chaque ville (Paris : encadrementdesloyers.appart.fr, autres : sites préfectoraux).",
        ],
      },
      {
        title: "2. Comprendre les loyers de référence",
        paragraphs: [
          "Les loyers de référence sont calculés par quartier, par type de logement (vide ou meublé), par nombre de pièces et par époque de construction. Ils sont exprimés en €/m² et révisés annuellement. Trois valeurs sont publiées : le loyer de référence (valeur médiane du marché), le loyer de référence majoré (plafond = loyer de référence × 1,2) et le loyer de référence minoré (plancher = loyer de référence × 0,7).",
          "Pour vérifier si votre loyer est conforme, calculez votre loyer en €/m² (loyer hors charges ÷ surface habitable) et comparez-le au loyer de référence majoré de votre quartier pour les caractéristiques de votre logement. Si votre loyer en €/m² dépasse le loyer de référence majoré, vous devez le baisser.",
          "Le complément de loyer est la seule exception légale au plafond. Il peut être ajouté si le logement présente des caractéristiques exceptionnelles par rapport aux logements comparables du quartier : vue sur un monument, terrasse privative, équipements haut de gamme. Le complément doit être mentionné dans le bail et son montant justifié — il peut être contesté par le locataire devant la commission de conciliation dans les 3 mois suivant la signature.",
        ],
        bullets: [
          "Loyer de référence = médiane du marché local (par m², type de bien, époque, nombre de pièces).",
          "Loyer de référence majoré = plafond légal (loyer de référence × 1,2).",
          "Loyer de référence minoré = plancher (le locataire peut demander une baisse en dessous).",
          "Complément de loyer : autorisé pour caractéristiques exceptionnelles, à justifier dans le bail.",
          "Meublé vs vide : loyer de référence majoré meublé ≈ 10-15 % supérieur au vide.",
        ],
      },
      {
        title: "3. Les règles de relocation en zone tendue",
        paragraphs: [
          "En zone tendue (liste définie par décret, incluant environ 1 149 communes), le loyer à la relocation (changement de locataire) est plafonné par le loyer du précédent locataire, sauf exceptions. Cette règle s'applique indépendamment de l'encadrement des loyers et concerne toutes les communes de la liste.",
          "Les exceptions permettant une augmentation à la relocation sont limitées : le logement est vacant depuis plus de 18 mois, des travaux d'amélioration représentant au moins 6 mois de loyer ont été effectués au cours des 6 derniers mois, le loyer est manifestement sous-évalué par rapport au marché (la sous-évaluation doit être documentée par des références comparables).",
          "Si vous êtes en zone tendue ET en encadrement des loyers, les deux contraintes s'appliquent cumulativement : votre loyer doit respecter à la fois le loyer de référence majoré et le loyer du précédent locataire (le plus contraignant des deux s'impose).",
        ],
        bullets: [
          "Zone tendue : ~1 149 communes (vérifier sur service-public.fr).",
          "Principe : loyer de relocation ≤ loyer du précédent locataire.",
          "Exception 1 : vacance > 18 mois.",
          "Exception 2 : travaux ≥ 6 mois de loyer dans les 6 derniers mois.",
          "Exception 3 : loyer manifestement sous-évalué (avec références documentées).",
          "En encadrement + zone tendue : la contrainte la plus restrictive s'impose.",
        ],
        note: "Si vous ne connaissez pas le loyer du précédent locataire (achat du bien avec locataire sortant, oubli), l'ADIL de votre département peut vous conseiller sur la marche à suivre. L'absence de loyer de référence documenté ne vous exonère pas du plafonnement.",
      },
      {
        title: "4. Fixer un loyer attractif sans se sous-évaluer",
        paragraphs: [
          "Un loyer trop élevé allonge la vacance locative et attire des dossiers en surdétente. Un loyer trop bas vous fait perdre de la rentabilité et peut être difficile à réviser rapidement. L'objectif est de vous positionner dans la fourchette haute du marché comparable, en respectant les plafonds légaux.",
          "Pour un bien hors encadrement, analysez les annonces comparables (même secteur, même superficie, même type de bail, même état) sur Leboncoin, SeLoger et les observatoires locaux des loyers. Croisez 5 à 10 références récentes. Positionnez-vous à 95-105 % de la médiane observée selon l'état et les équipements de votre logement.",
          "Un logement bien présenté (photos professionnelles, description claire, DPE A ou B) se loue plus vite et justifie un loyer dans la fourchette haute du marché. Un DPE F ou G peut au contraire forcer un positionnement plus bas pour trouver preneur, surtout si le loyer est gelé à la relocation.",
        ],
        bullets: [
          "Analyser 5 à 10 références comparables récentes (même secteur, superficie, type de bail).",
          "Positionner dans la fourchette haute si le logement est en bon état et bien présenté.",
          "DPE A-B : argument pour un loyer en haut de fourchette.",
          "DPE F-G : peut forcer un positionnement bas + loyer gelé à la relocation.",
          "Vacance locative : coût d'un mois de vacance > économie réalisée sur 12 mois à un loyer trop élevé.",
        ],
      },
      {
        title: "5. Mentionner le loyer dans le bail et prévoir la révision",
        paragraphs: [
          "Le bail doit mentionner séparément : le montant du loyer hors charges, le montant des provisions sur charges (ou du forfait charges pour un meublé), le montant du dépôt de garantie, et si applicable, le montant du complément de loyer et sa justification.",
          "Pour que la révision IRL soit possible chaque année, le bail doit comporter une clause de révision. Sans cette clause, le loyer est gelé pendant toute la durée du bail, même si l'IRL augmente de 5 %. La clause doit mentionner la période de référence IRL (trimestre) et la date anniversaire de révision.",
          "En zone d'encadrement, le bail doit également mentionner le loyer du précédent locataire (en cas de relocation) et, si applicable, le montant du complément de loyer et les raisons qui le justifient. L'absence de ces mentions peut être invoquée par le locataire pour contester le loyer.",
        ],
        bullets: [
          "Bail : loyer HC, provisions ou forfait charges, dépôt de garantie — séparément.",
          "Clause de révision IRL obligatoire pour pouvoir augmenter chaque année.",
          "Trimestre IRL de référence et date anniversaire à mentionner.",
          "En encadrement : loyer de référence majoré applicable à mentionner dans le bail.",
          "Complément de loyer : à justifier dans le bail si applicable.",
          "Relocation en zone tendue : loyer du précédent locataire à mentionner.",
        ],
      },
      {
        title: "6. Comment lokt vous aide",
        paragraphs: [
          "Le simulateur de rendement locatif lokt vous permet de comparer différents scénarios de loyer : pour une adresse donnée, vous simulez l'impact sur le rendement brut et net selon le loyer mensuel, les charges et la fiscalité choisie (LMNP, revenus fonciers, SCI). Vous identifiez rapidement le loyer optimal entre rentabilité cible et attractivité marché.",
          "L'espace bailleur lokt affiche pour chaque logement le loyer actuel, la date anniversaire de révision IRL et le nouveau loyer calculé. Vous suivez en un coup d'œil l'évolution du loyer dans le temps et ne ratez plus aucune révision.",
          "Pour les bailleurs avec plusieurs biens, le tableau de bord lokt consolide les loyers de l'ensemble du parc : loyer actuel, dernier IRL appliqué, prochaine révision. Vous pouvez identifier d'un coup d'œil les logements dont le loyer n'a pas été révisé depuis 2 ans.",
        ],
        bullets: [
          "Simulateur de rendement : impact du loyer sur la rentabilité brute et nette.",
          "Rappel de révision IRL automatique à la date anniversaire de chaque bail.",
          "Calcul du nouveau loyer IRL pré-rempli dans l'espace bailleur.",
          "Tableau de bord parc : loyer actuel et date de dernière révision pour chaque logement.",
          "Export du calcul de loyer révisé en PDF pour l'avenant au bail.",
        ],
      },
    ],
    checklist: [
      "Commune vérifiée : encadrement des loyers applicable ou non",
      "Zone tendue vérifiée : règles de relocation applicables ou non",
      "Loyer de référence majoré consulté si encadrement",
      "Loyer du précédent locataire vérifié si relocation en zone tendue",
      "Références de marché collectées (5 à 10 annonces comparables)",
      "Loyer positionné dans la fourchette légale et cohérent avec le marché",
      "Bail : loyer HC, charges et dépôt mentionnés séparément",
      "Clause de révision IRL et trimestre de référence inclus dans le bail",
      "Complément de loyer justifié si applicable",
    ],
    faq: [
      { q: "Comment savoir si mon logement est soumis à l'encadrement des loyers ?", a: "Vérifiez si votre commune fait partie de la liste des villes en encadrement (Paris depuis 2019, Lille depuis 2020, Lyon et Villeurbanne depuis 2021, Bordeaux et Montpellier depuis 2022, et d'autres communes qui rejoignent le dispositif). Chaque ville publie ses loyers de référence par quartier via un portail officiel — dépasser le loyer de référence majoré expose à une mise en conformité forcée et au remboursement du trop-perçu." },
      { q: "Peut-on augmenter librement le loyer en changeant de locataire ?", a: "Pas en zone tendue (environ 1 149 communes) : le loyer de relocation est en principe plafonné au loyer payé par le précédent locataire, sauf exceptions limitées (vacance de plus de 18 mois, travaux représentant au moins 6 mois de loyer dans les 6 derniers mois, ou loyer manifestement sous-évalué et documenté)." },
      { q: "Qu'est-ce que le complément de loyer et quand peut-on l'appliquer ?", a: "C'est la seule exception légale au plafond du loyer de référence majoré, réservée aux logements présentant des caractéristiques exceptionnelles par rapport aux biens comparables du quartier (vue remarquable, terrasse privative, équipements haut de gamme). Il doit être justifié et mentionné dans le bail, et peut être contesté par le locataire dans les 3 mois suivant la signature." },
    ],
    sources: [
      { label: "Service-Public : encadrement des loyers", href: "https://www.service-public.fr/particuliers/vosdroits/F1519" },
      { label: "Service-Public : zones tendues (liste communes)", href: "https://www.service-public.fr/simulateur/calcul/zones-tendues" },
      { label: "ANIL : fixer le loyer d'un logement", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/loyer/fixer-le-loyer/" },
    ],
  },
  {
    slug: "declarer-revenus-locatifs",
    category: "fiscal",
    title: "Déclarer ses revenus locatifs 2026 : LMNP ou nu",
    shortTitle: "Déclaration revenus locatifs",
    description:
      "Comprendre les régimes fiscaux, les formulaires, les dates limites et les pénalités pour déclarer correctement ses revenus locatifs meublés (LMNP) ou nus en 2026.",
    updatedAt: "2026-07-11",
    intro:
      "Tout propriétaire bailleur est tenu de déclarer ses revenus locatifs à l'administration fiscale, quelle que soit leur nature — meublée ou nue, longue durée ou saisonnière. L'obligation s'applique dès le premier euro encaissé. Ignorer cette règle expose à des pénalités qui peuvent atteindre 40 % des impôts dus en cas de bonne foi non reconnue, et 80 % en cas de manœuvres frauduleuses. Ce guide couvre les régimes disponibles, les formulaires à remplir, les délais à respecter et les pénalités encourues. Il ne remplace pas un expert-comptable ou un professionnel du droit : pour toute situation complexe (déficit foncier élevé, transmission, SCI), consultez un spécialiste.",
    sections: [
      {
        title: "1. Qui doit déclarer ses revenus locatifs ?",
        paragraphs: [
          "L'obligation de déclaration s'applique à tous les propriétaires qui perçoivent des revenus de la location d'un bien immobilier, qu'il soit meublé ou non. Elle concerne aussi bien les locations à titre de résidence principale que les locations saisonnières, les locations de parking, de cave ou de box, dès lors qu'un loyer est encaissé.",
          "Les revenus locatifs doivent être déclarés même s'ils sont faibles, même si le bien est en déficit, et même si le bailleur est salarié ou retraité. Il n'existe pas de seuil d'exonération général. La seule exception est la location d'une partie de la résidence principale à titre occasionnel dans certaines conditions très précises (chambre chez l'habitant, valeur locative modique fixée par l'administration), qui peut bénéficier d'une exonération sous conditions.",
          "En pratique, la déclaration s'effectue dans le cadre de la déclaration annuelle de revenus (formulaire 2042), complétée selon le régime applicable. Le régime ne s'applique pas bien par bien : en France, le choix entre micro et réel s'applique à l'ensemble des biens d'une même catégorie fiscale. Un bailleur qui possède deux appartements meublés déclare l'ensemble sous un seul régime LMNP.",
        ],
        bullets: [
          "Obligation dès le premier euro de loyer encaissé.",
          "Aucune distinction entre résidence principale du locataire et résidence secondaire.",
          "Locations saisonnières, meublées de tourisme, chambres chez l'habitant : même obligation.",
          "Le régime micro ou réel s'applique par catégorie fiscale (LMNP, nu, Pinel), pas par bien.",
          "La déclaration s'effectue chaque année au printemps, via impots.gouv.fr ou sur papier.",
        ],
      },
      {
        title: "2. Le calendrier fiscal 2026 : ne pas manquer les délais",
        paragraphs: [
          "La campagne de déclaration des revenus s'ouvre généralement début avril et se ferme en mai ou juin selon le département de résidence. En 2026, les dates indicatives pour la déclaration en ligne sont les suivantes : département 01 à 19 — mi-mai ; département 20 à 54 — fin mai ; département 55 à 976 — début juin. La date exacte est publiée chaque année sur impots.gouv.fr.",
          "Pour les propriétaires au régime réel en LMNP (formulaire 2031), la liasse fiscale doit être déposée auprès du Service des Impôts des Entreprises (SIE) avant la déclaration de revenus. Cette obligation spécifique est distincte de la déclaration personnelle 2042. Le non-dépôt de la liasse 2031 est une infraction distincte, sanctionnée par une amende forfaitaire.",
          "En cas de première mise en location dans l'année, le bien doit être déclaré dès l'exercice fiscal concerné. Il n'existe pas de délai de grâce pour une première déclaration locative. Si vous avez commencé à percevoir des loyers en 2025, vous devez les déclarer au printemps 2026 lors de la campagne déclarative.",
        ],
        bullets: [
          "Ouverture de la campagne : début avril chaque année.",
          "Clôture : mi-mai à début juin selon le département (en ligne).",
          "LMNP réel : liasse 2031 à déposer au SIE avant ou avec la déclaration personnelle.",
          "Première location : déclaration obligatoire dès le premier exercice, sans délai de grâce.",
          "Adhésion à un Centre de Gestion Agréé (CGA) recommandée en LMNP réel pour bénéficier de l'abattement de 1/4 d'impôt supprimé depuis 2023 — à vérifier selon l'évolution législative.",
        ],
        note: "Les dates exactes changent chaque année. Consultez impots.gouv.fr en début d'année pour confirmer le calendrier en vigueur.",
      },
      {
        title: "3. LMNP micro-BIC : la simplicité avec un abattement forfaitaire",
        paragraphs: [
          "Le régime micro-BIC s'applique automatiquement si vos recettes locatives meublées annuelles sont inférieures à 77 700 € (pour les meublés longue durée). Pour les meublés de tourisme classés, le seuil est de 188 700 € avec un abattement de 71 %. Ce régime est le plus simple : vous n'avez pas à détailler vos charges. L'administration fiscale applique un abattement forfaitaire de 50 % sur vos recettes brutes, et vous êtes imposé sur la moitié.",
          "En pratique, vous reportez sur la déclaration 2042-C-PRO (section « Locations meublées non professionnelles / Micro-BIC ») le total de vos recettes brutes encaissées dans l'année, y compris les charges récupérées sur le locataire. Les impôts calculent eux-mêmes la base imposable en appliquant l'abattement. Si vos loyers annuels s'élèvent à 12 000 €, vous serez imposé sur 6 000 € au micro-BIC standard.",
          "Le micro-BIC est avantageux si vos charges réelles représentent moins de 50 % de vos recettes. Inversement, si vous avez un crédit immobilier avec des intérêts importants, des travaux ou des frais de gestion élevés, le régime réel peut permettre d'abaisser significativement la base imposable, voire de générer un déficit reportable.",
        ],
        bullets: [
          "Seuil micro-BIC : 77 700 € de recettes annuelles (meublé longue durée).",
          "Abattement forfaitaire de 50 % sur les recettes brutes.",
          "Meublé de tourisme classé : seuil 188 700 €, abattement 71 %.",
          "Formulaire : 2042-C-PRO, section LMNP Micro-BIC.",
          "Aucune comptabilité détaillée des charges requise.",
        ],
      },
      {
        title: "4. LMNP réel : déduire ses charges et amortissements",
        paragraphs: [
          "Le régime réel simplifié s'applique sur option (ou automatiquement si les recettes dépassent le plafond micro-BIC). Son avantage principal est la déductibilité des charges réelles : intérêts d'emprunt, assurances, taxe foncière, charges de copropriété, frais de gestion, travaux d'entretien et de réparation, et — spécificité importante du LMNP — l'amortissement du mobilier.",
          "L'amortissement du mobilier permet de déduire chaque année une fraction de la valeur des meubles et équipements, typiquement sur 5 à 10 ans selon leur nature. En revanche, l'amortissement du bien immobilier lui-même n'est pas déductible en LMNP non professionnel : seul le mobilier s'amortit. Cette règle distingue le LMNP non-professionnel du statut LMP (professionnel).",
          "En régime réel, vous devez déposer une liasse fiscale 2031 auprès du Service des Impôts des Entreprises, puis reporter le résultat (bénéfice ou déficit) sur la déclaration personnelle 2042-C-PRO. Si le résultat est négatif (déficit BIC non professionnel), il n'est pas déductible du revenu global : il se reporte uniquement sur les bénéfices non professionnels des dix années suivantes. Un déficit LMNP ne réduit donc pas directement l'impôt sur les salaires.",
        ],
        bullets: [
          "Charges déductibles : intérêts d'emprunt, assurance, taxe foncière, copro, travaux, gestion.",
          "Amortissement du mobilier : déductible sur 5 à 10 ans selon les catégories.",
          "Amortissement immobilier : non déductible en LMNP non-professionnel.",
          "Formulaires : 2031 (liasse fiscale) + 2042-C-PRO (déclaration personnelle).",
          "Déficit LMNP : reportable sur les BIC non-pro des 10 années suivantes, pas sur le revenu global.",
          "Adhésion à un CGA ou accompagnement par un expert-comptable fortement recommandé.",
        ],
      },
      {
        title: "5. Location nue : micro-foncier et régime réel foncier",
        paragraphs: [
          "Les revenus d'une location nue (sans meubles) relèvent des revenus fonciers, non des BIC. Le régime micro-foncier s'applique automatiquement si les recettes brutes annuelles de l'ensemble de vos locations nues sont inférieures à 15 000 €. Il offre un abattement forfaitaire de 30 % sur les recettes brutes. Les recettes sont à reporter case 4BE de la déclaration 2042.",
          "Si vos recettes dépassent 15 000 €, ou si vous optez pour le régime réel, vous devez remplir le formulaire 2044 (déclaration des revenus fonciers). Ce formulaire détaille ligne par ligne les charges déductibles : intérêts d'emprunt, taxe foncière à votre charge, charges de copropriété non récupérables, primes d'assurance, travaux de réparation et d'entretien (mais pas de construction). Le résultat net est reporté en case 4BA (revenu foncier positif) ou 4BC (déficit imputable sur le revenu global).",
          "Le déficit foncier présente un avantage important en location nue : la partie due aux charges autres que les intérêts d'emprunt est imputable sur le revenu global dans la limite de 10 700 € par an. Le surplus se reporte sur les revenus fonciers des dix années suivantes. Cette faculté, absente en LMNP non-professionnel, fait de la location nue au réel une stratégie fiscale intéressante pour les propriétaires fortement chargés.",
        ],
        bullets: [
          "Micro-foncier : seuil 15 000 €, abattement 30 %, case 4BE de la 2042.",
          "Régime réel : formulaire 2044 + report en 2042.",
          "Déficit foncier imputable sur le revenu global : plafonné à 10 700 €/an.",
          "Le surplus de déficit se reporte 10 ans sur les revenus fonciers.",
          "Option pour le réel foncier : irrévocable pendant 3 ans.",
        ],
      },
      {
        title: "6. Investissement Pinel : réduction d'impôt et revenus fonciers",
        paragraphs: [
          "Le dispositif Pinel permet une réduction d'impôt sur le revenu calculée sur le prix d'acquisition du bien, dans la limite de 300 000 € et de 5 500 €/m². La réduction est étalée sur la durée d'engagement : 12 % sur 6 ans, 18 % sur 9 ans, 21 % sur 12 ans (taux applicables aux investissements réalisés avant le 31 décembre 2022). Pour les investissements postérieurs à 2023, vérifiez les taux du Pinel+ qui prévoient une décote progressive.",
          "La réduction s'impute sur l'impôt dû chaque année. Si elle dépasse l'impôt, le surplus n'est ni remboursé ni reporté : il est perdu. Par exemple, pour un bien acquis à 200 000 € avec un engagement de 9 ans, la réduction annuelle est 200 000 × 18 % / 9 = 4 000 €/an. Si votre impôt est inférieur à 4 000 €, vous ne pouvez pas bénéficier intégralement de la réduction.",
          "Parallèlement, les loyers perçus d'un bien Pinel sont des revenus fonciers à déclarer selon le régime foncier de droit commun (micro-foncier ou réel). La réduction Pinel est à reporter sur la déclaration 2042-C (cases 7QA pour 6 ans, 7QB pour 9 ans, 7QC pour 12 ans, selon l'année de votre premier engagement). Les revenus fonciers sont déclarés sur le formulaire 2044 le cas échéant.",
        ],
        bullets: [
          "Réduction Pinel : 12 % sur 6 ans, 18 % sur 9 ans, 21 % sur 12 ans (avant 2023).",
          "Plafond investissement : 300 000 € et 5 500 €/m².",
          "Cases réduction : 7QA (6 ans), 7QB (9 ans), 7QC (12 ans) — formulaire 2042-C.",
          "Revenus fonciers Pinel : déclarés séparément sur la 2044 + 2042.",
          "Réduction non reportable et non remboursable si supérieure à l'impôt dû.",
        ],
      },
      {
        title: "7. Pénalités en cas d'oubli, d'erreur ou de fraude",
        paragraphs: [
          "L'administration fiscale dispose de plusieurs outils pour sanctionner les omissions et erreurs de déclaration. Une déclaration déposée en retard, sans mise en demeure préalable, est majorée de 10 %. Si l'administration adresse une mise en demeure et que le contribuable ne régularise pas dans les 30 jours, la majoration passe à 40 %. Ce taux s'applique également en cas de manquement délibéré reconnu.",
          "En cas de manœuvres frauduleuses (utilisation de faux documents, dissimulation volontaire, faux en écriture), la majoration atteint 80 % des droits dus. S'y ajoutent des intérêts de retard de 0,20 % par mois (soit 2,4 % par an) calculés depuis la date à laquelle l'impôt aurait dû être payé. Ces intérêts s'appliquent en plus des majorations.",
          "L'administration fiscale peut procéder à un contrôle fiscal sur les trois dernières années civiles (droit de reprise triennal). En cas de revenus non déclarés, l'ensemble des années non prescrites peut faire l'objet d'un redressement. Si des revenus occultes sont présumés, le délai de reprise peut être étendu à dix ans. La régularisation spontanée avant tout contrôle (via la procédure de correction en ligne ou en contactant l'administration) réduit généralement les pénalités au minimum.",
        ],
        bullets: [
          "Retard sans mise en demeure : majoration de 10 % des droits dus.",
          "Retard après mise en demeure non respectée : majoration de 40 %.",
          "Manquement délibéré reconnu : majoration de 40 %.",
          "Manœuvres frauduleuses : majoration de 80 %.",
          "Intérêts de retard : 0,20 % par mois (2,4 %/an) en plus des majorations.",
          "Délai de reprise : 3 ans (général) — 10 ans en cas de revenus occultes présumés.",
          "Régularisation spontanée : réduit les pénalités, à entreprendre dès que l'oubli est constaté.",
        ],
        note: "Ces taux sont ceux en vigueur en 2026. Consultez impots.gouv.fr pour vérifier toute évolution législative.",
      },
      {
        title: "8. Ce que lokt.fr fait — et ne fait pas",
        paragraphs: [
          "lokt.fr est un outil de gestion locative et d'aide à la préparation de la déclaration. Il permet de centraliser vos loyers, vos charges, vos quittances et vos documents, et de générer une synthèse de ce que vous devez déclarer selon votre régime fiscal. Il calcule des estimations de base imposable, de déficit et de réduction Pinel à titre indicatif.",
          "lokt.fr n'est pas un logiciel de déclaration agréé par l'administration fiscale. Il ne transmet aucune donnée à l'administration. Les montants affichés sont des estimations basées sur les informations saisies par l'utilisateur. Les numéros de case indiqués sont fournis à titre indicatif et peuvent changer chaque année : vérifiez toujours sur impots.gouv.fr ou avec votre comptable avant de soumettre votre déclaration.",
          "lokt.fr ne remplace pas un expert-comptable, un Centre de Gestion Agréé (CGA) ou un conseiller fiscal. Pour une situation impliquant un déficit LMNP élevé, un bien en indivision, une SCI, une transmission ou tout montage complexe, l'accompagnement d'un professionnel est indispensable. lokt.fr ne peut pas être tenu responsable des erreurs ou omissions de déclaration résultant de l'utilisation de ses outils.",
        ],
        bullets: [
          "lokt.fr centralise vos données locatives pour vous aider à préparer votre déclaration.",
          "Les calculs sont des estimations — non des résultats fiscaux certifiés.",
          "lokt.fr ne dépose aucune déclaration officielle à votre place.",
          "Les numéros de case sont indicatifs : vérifiez sur impots.gouv.fr chaque année.",
          "Pour toute situation complexe, consultez un expert-comptable ou un CGA.",
        ],
      },
    ],
    checklist: [
      "Identifié le régime applicable : LMNP micro-BIC, LMNP réel, nu micro-foncier, nu réel ou Pinel.",
      "Recettes brutes de l'exercice relevées (loyers perçus + charges récupérées).",
      "Justificatifs des charges rassemblés : factures, relevés de taxe foncière, appels de copropriété.",
      "Intérêts d'emprunt vérifiés sur le tableau d'amortissement du crédit.",
      "En LMNP réel : amortissements mobilier calculés ou vérifiés par le comptable.",
      "Formulaires téléchargés : 2042, 2042-C-PRO (LMNP), 2044 (nu réel), 2042-C (Pinel).",
      "Date limite de déclaration en ligne vérifiée sur impots.gouv.fr.",
      "En LMNP réel : liasse 2031 préparée et déposée au SIE avant la déclaration personnelle.",
      "Dossier transmis à l'expert-comptable si situation complexe (déficit, indivision, SCI).",
      "Déclaration soumise et accusé de réception conservé.",
    ],
    faq: [
      { q: "Le Pinel existe-t-il encore pour un nouvel investissement en 2026 ?", a: "Non, il n'est plus possible de souscrire un nouvel investissement Pinel ou Pinel+ depuis le 1er janvier 2025. Seuls les engagements pris avant cette date continuent de produire leurs effets fiscaux jusqu'à leur terme (6, 9 ou 12 ans), avec les mêmes obligations de loyer plafonné et de ressources du locataire à respecter." },
      { q: "lokt.fr peut-il transmettre directement ma déclaration à l'administration fiscale ?", a: "Non. lokt.fr aide à préparer votre déclaration (centralisation des loyers, charges et documents, estimation de base imposable et de déficit) mais n'est pas un logiciel de déclaration agréé et ne transmet aucune donnée à l'administration. Les numéros de case indiqués sont fournis à titre indicatif et doivent être vérifiés sur impots.gouv.fr avant toute soumission." },
      { q: "Faut-il un expert-comptable pour déclarer des revenus locatifs ?", a: "Ce n'est obligatoire qu'en LMNP au régime réel, où une liasse fiscale (formulaire 2031) doit être déposée auprès du service des impôts des entreprises. En micro-foncier ou micro-BIC, la déclaration reste simple et gérable seul. Un accompagnement professionnel est en revanche fortement recommandé dès qu'il y a un déficit élevé, une indivision, une SCI ou une transmission en jeu." },
    ],
    sources: [
      { label: "impots.gouv.fr : revenus fonciers et BIC", href: "https://www.impots.gouv.fr/particulier/la-location-immobiliere" },
      { label: "Service-Public : LMNP et déclaration meublée", href: "https://www.service-public.fr/particuliers/vosdroits/F31100" },
      { label: "ANIL : fiscalité des revenus locatifs", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/fiscalite/" },
      { label: "Légifrance : article 1729 CGI (pénalités)", href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044981868" },
    ],
  },
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) || null;
}

export function getGuidesByCategory(category: GuideCategory) {
  return GUIDES.filter((guide) => guide.category === category);
}
