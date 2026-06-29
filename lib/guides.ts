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
  { key: "preparer", label: "Préparer la mise en location", description: "Sécuriser le logement, le bail et la fiscalité avant l'annonce." },
  { key: "arrivee", label: "Accueillir le locataire", description: "Constituer un dossier propre et réussir la remise des clés." },
  { key: "gestion", label: "Pendant la location", description: "Gérer les loyers, les charges, les travaux et les échéances." },
  { key: "depart", label: "Organiser le départ", description: "Traiter le congé, l'état des lieux et le dépôt de garantie." },
];

export const GUIDES: GuideArticle[] = [
  {
    slug: "checklist-mise-en-location",
    category: "preparer",
    title: "Mettre un logement en location : la checklist complète du bailleur",
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
    sources: [
      { label: "Service-Public : obligations du propriétaire bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059" },
      { label: "ANIL : diagnostics obligatoires", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/diagnostics/" },
      { label: "Légifrance : décret pièces justificatives (5 novembre 2015)", href: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031444493" },
    ],
  },
  {
    slug: "dpe-diagnostics-location",
    category: "preparer",
    title: "DPE et diagnostics locatifs : comprendre le dossier à remettre au locataire",
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
    sources: [
      { label: "Service-Public : rédaction du bail d'habitation vide", href: "https://www.service-public.fr/particuliers/vosdroits/F35109/0_0?idFicheParent=F920" },
      { label: "Impots.gouv.fr : les locations meublées", href: "https://www.impots.gouv.fr/particulier/les-locations-meublees" },
      { label: "ANIL : comparatif bail vide et bail meublé", href: "https://www.anil.org" },
    ],
  },
  {
    slug: "choisir-son-locataire",
    category: "arrivee",
    title: "Choisir son locataire : critères légaux, analyse du dossier et décision",
    shortTitle: "Choisir son locataire",
    description: "Comment sélectionner un locataire dans le respect de la loi : pièces autorisées, taux d'effort, comparaison des dossiers, garant, GLI et notification de la décision.",
    updatedAt: "2026-06-29",
    intro:
      "Choisir son locataire est souvent perçu comme une décision intuitive, mais elle repose sur un cadre légal précis. Le bailleur peut exiger certaines pièces, évaluer la solvabilité, demander un garant — et pas davantage. Dépasser ces limites expose à des sanctions pénales. Rester en deçà, c'est risquer de retenir un dossier insuffisant. Ce guide détaille les critères légaux, les pièces autorisées, la méthode pour comparer plusieurs candidatures et les bonnes pratiques pour notifier une décision.",
    sections: [
      {
        title: "1. Les pièces justificatives autorisées par la loi",
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
        title: "3. Évaluer la solvabilité : la règle des 3x et ses nuances",
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
        title: "5. Comparer plusieurs dossiers objectivement",
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
        ],
        bullets: [
          "Garant autorisé : si pas de GLI souscrite par le bailleur (sauf locataire étudiant ou apprenti).",
          "Acte de cautionnement : mention manuscrite obligatoire (article 22-1 loi 1989).",
          "Caution à durée limitée (bail) ou indéterminée : dans les deux cas, une résiliation par LRAR est possible avec un délai de préavis.",
          "Visale : garantie gratuite d'Action Logement, éligible sous conditions, alternative solide.",
          "Caution solidaire vs simple : la solidaire est immédiatement actionnable ; la simple impose une mise en demeure infructueuse du locataire d'abord.",
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
    sources: [
      { label: "Service-Public : dépôt de garantie", href: "https://www.service-public.fr/particuliers/vosdroits/F31269" },
      { label: "ANIL : restitution du dépôt de garantie", href: "https://www.anil.org/votre-projet/vous-etes-proprietaire/bailleur/location-vide/depot-de-garantie/" },
      { label: "Commission Nationale de Concertation : grille de vétusté", href: "https://www.anil.org" },
    ],
  },
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) || null;
}

export function getGuidesByCategory(category: GuideCategory) {
  return GUIDES.filter((guide) => guide.category === category);
}
