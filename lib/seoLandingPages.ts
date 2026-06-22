export type SeoLandingPage = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  primaryCta: string;
  secondaryCta?: { label: string; href: string };
  updatedAt: string;
  intent: string;
  sections: Array<{
    title: string;
    body: string[];
    bullets?: string[];
  }>;
  faq: Array<{ q: string; a: string }>;
  links: Array<{ label: string; href: string; text: string }>;
};

const today = "2026-06-23";

export const SEO_LANDING_PAGES: SeoLandingPage[] = [
  {
    slug: "modele-quittance-loyer-pdf",
    title: "Modèle de quittance de loyer PDF gratuit",
    metaTitle: "Modèle quittance de loyer PDF gratuit | lokt.fr",
    description:
      "Modèle de quittance de loyer PDF pour bailleur : mentions utiles, paiement complet, reçu partiel, charges, routine mensuelle et archivage.",
    eyebrow: "Quittance de loyer",
    h1: "Modèle de quittance de loyer PDF gratuit pour bailleur",
    intro:
      "Une quittance de loyer doit rester simple, mais elle engage le bailleur : elle atteste que le locataire a payé l’intégralité du loyer et des charges pour une période donnée. La bonne page n’est donc pas seulement un modèle PDF : elle doit expliquer quand l’émettre, quoi écrire dedans et comment garder un suivi propre.",
    primaryCta: "Créer une quittance dans l’outil bailleur",
    updatedAt: today,
    intent: "Requête cible : modèle quittance de loyer PDF gratuit",
    sections: [
      {
        title: "1. Quand remettre une quittance ?",
        body: [
          "La quittance est remise lorsque le paiement du loyer et des charges de la période est complet. Si le locataire en fait la demande et que le paiement est complet, le bailleur doit la transmettre gratuitement.",
          "La quittance ne doit pas être utilisée pour valider un paiement incertain. Avant de générer le PDF, vérifiez l’encaissement effectif sur le compte bancaire, le montant payé, la période concernée et l’identité du bail.",
          "En cas de paiement partiel, il vaut mieux produire un reçu qui précise uniquement la somme réellement versée. Ce reçu ne solde pas la période : il laisse apparaître le reste dû.",
        ],
        bullets: [
          "Paiement complet confirmé.",
          "Loyer et charges de la période soldés.",
          "Quittance gratuite si le locataire la demande.",
          "Reçu distinct en cas de paiement partiel.",
          "Aucune quittance avant validation bancaire.",
          "Archivage par bail et par période.",
        ],
      },
      {
        title: "2. Les mentions à faire apparaître dans le PDF",
        body: [
          "Un modèle de quittance doit identifier clairement le bailleur, le locataire et le logement. Il doit aussi indiquer la période payée, par exemple du 1er au 30 juin 2026, et la date d’émission du document.",
          "Les sommes doivent être lisibles : loyer hors charges, charges ou provisions/forfait, total payé. Cette distinction est importante, car une quittance ne doit pas mélanger le loyer, les charges récupérables et d’autres sommes comme un dépôt de garantie.",
          "Une formulation simple suffit : le bailleur reconnaît avoir reçu du locataire la somme correspondant au loyer et aux charges pour la période indiquée, sous réserve d’encaissement effectif si le paiement vient tout juste d’être reçu.",
        ],
        bullets: [
          "Nom et coordonnées du bailleur.",
          "Nom du locataire.",
          "Adresse du logement loué.",
          "Période concernée.",
          "Loyer hors charges.",
          "Charges distinguées.",
          "Total payé.",
          "Date d’émission.",
        ],
      },
      {
        title: "3. Exemple de contenu pour une quittance",
        body: [
          "Objet : quittance de loyer pour la période du 1er juin 2026 au 30 juin 2026.",
          "Je soussigné, bailleur du logement situé à l’adresse indiquée au bail, reconnais avoir reçu du locataire la somme totale de 850 €, correspondant à 760 € de loyer hors charges et 90 € de charges pour la période mentionnée.",
          "Cette quittance vaut justificatif du paiement complet pour la période indiquée. Elle ne vaut pas renonciation aux sommes qui pourraient rester dues au titre d’une autre période ou d’une régularisation distincte.",
        ],
        bullets: [
          "Adapter les dates à la période réelle.",
          "Ne pas inclure un mois non payé.",
          "Ne pas créer de quittance globale ambiguë.",
          "Conserver le PDF avec le bail.",
        ],
      },
      {
        title: "4. Suivre loyers, quittances et paiements partiels",
        body: [
          "Une gestion fiable repose sur une routine mensuelle : rapprocher le paiement attendu du paiement réellement reçu, traiter rapidement les écarts et archiver les documents. Cette discipline devient précieuse dès le premier retard ou lors du départ du locataire.",
          "Le suivi doit distinguer paiement attendu, paiement reçu, paiement partiel, absence de paiement, relance et quittance générée. Une simple case “payé” finit vite par masquer les situations importantes.",
          "Si un paiement est incomplet, notez la somme reçue, le solde restant dû, la date de relance et les échanges. La quittance complète attendra le règlement du solde.",
        ],
        bullets: [
          "Vérifier le loyer et les charges attendus.",
          "Confirmer l’encaissement réel.",
          "Distinguer paiement complet et partiel.",
          "Relancer sans perdre l’historique.",
          "Générer la quittance seulement quand le mois est soldé.",
          "Archiver justificatifs et échanges.",
        ],
      },
      {
        title: "5. Charges : ce qu’il faut distinguer",
        body: [
          "Les charges récupérables sont des dépenses d’abord payées par le bailleur puis remboursées par le locataire dans le cadre prévu par le bail. La quittance doit les distinguer du loyer hors charges.",
          "En logement vide, les charges sont généralement payées par provisions avec une régularisation annuelle. La régularisation compare les provisions demandées aux dépenses réelles justifiées.",
          "En meublé, le bail peut prévoir des provisions avec régularisation ou un forfait. Le forfait ne fonctionne pas comme une avance : il ne donne pas lieu à une régularisation ultérieure.",
        ],
        bullets: [
          "Loyer hors charges séparé.",
          "Provisions ou forfait indiqués clairement.",
          "Régularisation annuelle prévue si charges au réel.",
          "Justificatifs conservés.",
        ],
      },
      {
        title: "6. Pourquoi générer le PDF depuis un suivi locatif ?",
        body: [
          "Un modèle isolé dépanne, mais il ne garde pas l’historique des paiements. Dans lokt.fr, la quittance est rattachée au bail, au locataire et au mois suivi.",
          "Cela évite les doublons, les erreurs de période, les documents envoyés avant confirmation du paiement et les archives dispersées entre emails, dossiers PDF et tableurs.",
          "Le bon workflow est simple : créer le bail, suivre le loyer attendu, confirmer le paiement, générer la quittance PDF, puis l’archiver ou l’envoyer au locataire.",
        ],
        bullets: [
          "Une quittance par bail et par période.",
          "PDF bloqué tant que le paiement n’est pas complet.",
          "Historique consultable en cas de départ.",
          "Finance alimentée par les loyers confirmés.",
        ],
      },
    ],
    faq: [
      { q: "Une quittance est-elle obligatoire ?", a: "Le bailleur doit fournir gratuitement une quittance au locataire qui en fait la demande, si le paiement est complet." },
      { q: "Peut-on envoyer une quittance par email ?", a: "Oui, l’envoi électronique est courant, à condition de conserver un exemplaire fiable, lisible et rattaché à la bonne période." },
      { q: "Que faire si le locataire paie seulement une partie ?", a: "Il faut éviter la quittance complète et privilégier un reçu mentionnant le montant réellement encaissé." },
      { q: "La quittance doit-elle distinguer loyer et charges ?", a: "Oui. Le document doit détailler les sommes versées en distinguant le loyer et les charges." },
      { q: "Un forfait de charges en meublé se régularise-t-il ?", a: "Non. Si le bail prévoit un forfait de charges, il ne donne pas lieu à une régularisation ultérieure. Les provisions, elles, supposent une régularisation." },
    ],
    links: [
      { label: "Outil bailleur", href: "/outil-gestion-locative", text: "Gérer baux, loyers, quittances et relances dans le même espace." },
      { label: "Service-Public : modèle de quittance", href: "https://www.service-public.fr/particuliers/vosdroits/R54103", text: "Consulter la source officielle sur le modèle de quittance de loyer." },
      { label: "Service-Public : charges locatives", href: "https://www.service-public.fr/particuliers/vosdroits/F947", text: "Vérifier les règles de charges récupérables, provisions, forfait et régularisation." },
    ],
  },
  {
    slug: "gestion-locative-proprietaire-particulier",
    title: "Gestion locative pour propriétaire particulier",
    metaTitle: "Gestion locative propriétaire particulier | lokt.fr",
    description:
      "Gérer soi-même une location sans agence : bail, locataire, loyer, quittance, charges, documents, travaux, départ et alertes pour propriétaire particulier.",
    eyebrow: "Propriétaire bailleur",
    h1: "Gestion locative pour propriétaire particulier",
    intro:
      "Beaucoup de bailleurs particuliers veulent gérer eux-mêmes leur logement, sans agence, mais avec un cadre plus fiable qu’un tableur ou des dossiers dispersés. L’enjeu n’est pas seulement de gagner des frais de gestion : il faut garder un dossier propre, réagir au bon moment et conserver les preuves utiles pendant toute la vie du bail.",
    primaryCta: "Créer mon espace bailleur",
    secondaryCta: { label: "Comparer avec l’outil complet", href: "/outil-gestion-locative" },
    updatedAt: today,
    intent: "Requête cible : gestion locative propriétaire particulier",
    sections: [
      {
        title: "1. Préparer le logement avant la mise en location",
        body: [
          "La gestion locative commence avant l’arrivée du locataire. Le bailleur doit s’assurer que le logement peut être loué, qu’il est décent, que les diagnostics sont disponibles et que le bail correspond au type de location choisi.",
          "Un propriétaire particulier gagne du temps en préparant un dossier unique par logement : diagnostics, assurance, règlement de copropriété utile, photos, équipements, modèles de bail, état des lieux et coordonnées importantes.",
          "Pour une location meublée, l’inventaire doit être traité dès le départ. Pour une location vide, le suivi documentaire est plus léger, mais les diagnostics, le bail et l’état des lieux restent centraux.",
        ],
        bullets: [
          "Logement décent et assurable.",
          "Diagnostics locatifs disponibles.",
          "Type de bail choisi : vide, meublé ou mobilité.",
          "Loyer et charges clairement séparés.",
          "État des lieux préparé.",
          "Dossier logement centralisé.",
        ],
      },
      {
        title: "2. Réussir l’entrée du locataire",
        body: [
          "L’entrée dans les lieux est le moment où le dossier devient concret. Le bail, les annexes, l’assurance, l’état des lieux, les compteurs, les clés et le dépôt de garantie doivent être cohérents entre eux.",
          "Un état des lieux précis protège le bailleur autant que le locataire. Il doit décrire l’état réel du logement, pièce par pièce, et être conservé avec le bail. Les photos sont utiles si elles sont datées, lisibles et rattachées au bon dossier.",
          "Le dépôt de garantie n’est pas un loyer d’avance. Il doit être suivi séparément, avec son montant, sa date d’encaissement et les conditions de restitution au départ.",
        ],
        bullets: [
          "Bail signé et archivé.",
          "Assurance habitation vérifiée.",
          "État des lieux d’entrée complet.",
          "Clés, badges et compteurs relevés.",
          "Dépôt de garantie suivi à part.",
          "Coordonnées locataire à jour.",
        ],
      },
      {
        title: "3. Ce qu’il faut suivre chaque mois",
        body: [
          "Le cœur de la gestion locative reste la routine mensuelle : vérifier le paiement, traiter les retards, produire la quittance si le loyer est payé et conserver les échanges utiles.",
          "Le suivi doit distinguer le loyer hors charges, les charges, le montant attendu, le montant réellement encaissé, la date de paiement et le statut de la quittance. Un paiement partiel ne doit pas déclencher une quittance complète.",
          "À cela s’ajoutent les échéances moins fréquentes : régularisation des charges, révision de loyer IRL, renouvellement du bail, diagnostics à surveiller, travaux et départ du locataire.",
        ],
        bullets: [
          "Paiement attendu et paiement reçu.",
          "Retard ou paiement partiel.",
          "Quittance générée seulement après paiement complet.",
          "Relance datée et conservée.",
          "Charges à régulariser si provisions.",
          "Échéances de bail suivies.",
        ],
      },
      {
        title: "4. Classer les documents sans se perdre",
        body: [
          "Le problème d’un bailleur particulier n’est pas toujours le manque d’information, mais la dispersion : un PDF dans les emails, une facture sur le bureau, un état des lieux dans un dossier local et une quittance dans un tableur.",
          "L’objectif est d’avoir un dossier lisible par logement, puis par bail. Chaque document doit répondre à une question simple : à quel bien, quel locataire, quelle période et quelle action se rattache-t-il ?",
          "Ce classement devient décisif lors d’un litige, d’un départ de locataire, d’une régularisation de charges ou d’une préparation fiscale.",
        ],
        bullets: [
          "Bail et annexes.",
          "Diagnostics.",
          "État des lieux et photos.",
          "Quittances et reçus.",
          "Factures de travaux.",
          "Justificatifs de charges.",
          "Échanges importants.",
          "Documents de départ.",
        ],
      },
      {
        title: "5. Gérer retards, travaux et incidents",
        body: [
          "Un retard de paiement doit être détecté tôt, sans attendre que plusieurs mois s’accumulent. La première étape consiste à vérifier l’encaissement, qualifier la situation et conserver une trace de la relance.",
          "Pour les travaux ou réparations, le bon réflexe est de documenter le signalement : date, description, photos, urgence, intervention, devis, facture et conclusion. Cela évite de reconstruire l’historique au moment du départ.",
          "Un outil de gestion ne remplace pas le jugement du bailleur, mais il évite que les informations soient oubliées ou mélangées entre plusieurs biens.",
        ],
        bullets: [
          "Retard identifié automatiquement.",
          "Relance proportionnée.",
          "Paiement partiel isolé.",
          "Signalement travaux daté.",
          "Devis et factures rattachés au bien.",
          "Historique conservé par bail.",
        ],
      },
      {
        title: "6. Préparer le départ du locataire",
        body: [
          "La sortie se prépare avant la remise des clés. Il faut retrouver rapidement le bail, l’état des lieux d’entrée, l’inventaire éventuel, les paiements, les quittances, le dépôt de garantie et les travaux déjà documentés.",
          "L’état des lieux de sortie doit être comparé à l’état d’entrée. Les retenues éventuelles sur dépôt de garantie doivent être justifiées par des éléments concrets : dégradations imputables, devis, factures ou justificatifs.",
          "Un dossier bien tenu rend la restitution du dépôt de garantie plus simple et limite les échanges confus après le départ.",
        ],
        bullets: [
          "Préavis et date de sortie suivis.",
          "État des lieux d’entrée retrouvé.",
          "Paiements et quittances vérifiés.",
          "Travaux et retenues documentés.",
          "Dépôt de garantie traité séparément.",
          "Clôture du bail archivée.",
        ],
      },
      {
        title: "7. Pourquoi un outil dédié aide un particulier",
        body: [
          "Un particulier n’a pas forcément besoin d’un logiciel complexe. Il a surtout besoin d’un espace qui relie le bien, le locataire, le bail et les documents pour éviter les oublis.",
          "Un bon outil doit rester compréhensible au premier logement, mais assez structuré pour suivre plusieurs baux : tableau de bord, alertes, quittances, documents, finance simple et historique.",
          "Dans lokt.fr, l’idée est de garder une gestion lisible : ce qui est payé, ce qui manque, ce qui doit être envoyé, ce qui doit être archivé et ce qui mérite une action aujourd’hui.",
        ],
        bullets: [
          "Un dossier par logement.",
          "Une chronologie par bail.",
          "Des quittances cohérentes.",
          "Des alertes simples.",
          "Des données prêtes pour la finance.",
          "Une vue claire des actions à faire.",
        ],
      },
    ],
    faq: [
      { q: "Peut-on gérer sans agence ?", a: "Oui, à condition de respecter les obligations du bailleur, de conserver les preuves importantes et de suivre les échéances du bail." },
      { q: "Quel est le risque principal ?", a: "Le risque le plus fréquent est l’oubli : paiement non suivi, quittance mal datée, document manquant, travaux non documentés ou départ mal préparé." },
      { q: "Un tableur suffit-il pour un propriétaire particulier ?", a: "Il peut dépanner au début, mais il ne relie pas naturellement bail, locataire, documents, quittances, relances et historique du logement." },
      { q: "Que faut-il suivre en priorité chaque mois ?", a: "Le paiement attendu, le montant encaissé, les retards, les paiements partiels, les quittances générables et les échanges importants avec le locataire." },
      { q: "lokt.fr est-il adapté à un premier bien ?", a: "Oui, l’outil est pensé pour un bailleur particulier qui commence, avec un logement actif gratuit et une structure qui reste utile si le parc grandit." },
    ],
    links: [
      { label: "Outil de gestion locative", href: "/outil-gestion-locative", text: "La page produit pour gérer un logement de bout en bout." },
      { label: "Modèle quittance PDF", href: "/modele-quittance-loyer-pdf", text: "Comprendre quand générer une quittance et comment suivre les paiements." },
      { label: "Service-Public : obligations bailleur", href: "https://www.service-public.fr/particuliers/vosdroits/N31059", text: "Vérifier les obligations générales du propriétaire bailleur." },
      { label: "Service-Public : documents du bail", href: "https://www.service-public.fr/particuliers/vosdroits/F2066", text: "Identifier les documents à remettre ou conserver pendant la location." },
    ],
  },
  {
    slug: "suivi-loyers-impayes",
    title: "Suivi des loyers et impayés",
    metaTitle: "Suivi loyers impayés et relances | lokt.fr",
    description:
      "Mettre en place un suivi des loyers et impayés : échéances, paiements partiels, retards, relances, quittances, garant et historique bailleur.",
    eyebrow: "Loyers et relances",
    h1: "Suivi des loyers impayés : passer du tableau au pilotage",
    intro:
      "Un impayé se traite mieux lorsqu’il est détecté tôt. Le suivi doit distinguer paiement attendu, paiement reçu, paiement partiel, retard, relance, garant éventuel et quittance générable. L’objectif n’est pas d’empiler des colonnes : il faut savoir quelle action mener aujourd’hui, et garder une preuve de ce qui a déjà été fait.",
    primaryCta: "Suivre mes loyers",
    secondaryCta: { label: "Voir les quittances", href: "/modele-quittance-loyer-pdf" },
    updatedAt: today,
    intent: "Requête cible : tableau suivi loyers impayés",
    sections: [
      {
        title: "1. Construire un suivi qui montre l’action à faire",
        body: [
          "Un bon tableau de suivi ne se limite pas à une case payé/non payé. Il doit montrer la période, l’échéance, le montant attendu, le montant reçu, la date de paiement, le solde restant dû et la prochaine action.",
          "La période doit être explicite : par exemple janvier 2026, avec une date d’échéance prévue au bail. Cela évite de mélanger un paiement reçu en retard avec le mois suivant.",
          "Le suivi devient vraiment utile lorsqu’il affiche une priorité : à vérifier, à relancer, paiement partiel, quittance à générer, quittance bloquée ou dossier à documenter.",
        ],
        bullets: [
          "Période de loyer.",
          "Échéance contractuelle.",
          "Loyer hors charges.",
          "Charges ou forfait.",
          "Montant attendu.",
          "Montant encaissé.",
          "Solde restant dû.",
          "Dernière relance.",
          "Quittance disponible ou bloquée.",
        ],
      },
      {
        title: "2. Distinguer retard, paiement partiel et impayé",
        body: [
          "Un retard de quelques jours, un paiement partiel et une absence totale de paiement ne se pilotent pas de la même manière. Le suivi doit donc qualifier la situation avant de produire une relance.",
          "En cas de paiement partiel, le bailleur doit enregistrer le montant réellement reçu, conserver le solde et éviter de générer une quittance complète. Un reçu partiel peut être plus adapté tant que la période n’est pas soldée.",
          "Un impayé répété doit être documenté avec précision : dates, montants, relances, réponse du locataire, activation éventuelle du garant ou de l’assurance, et pièces utiles en cas de suite contentieuse.",
        ],
        bullets: [
          "Retard simple : paiement attendu non reçu.",
          "Paiement partiel : somme reçue mais mois non soldé.",
          "Impayé : dette persistante à suivre.",
          "Quittance complète seulement après paiement intégral.",
          "Historique conservé par bail.",
        ],
      },
      {
        title: "3. Relancer sans perdre l’historique",
        body: [
          "Les relances doivent rester datées, lisibles et proportionnées. Conserver l’historique permet de comprendre rapidement ce qui s’est passé si le retard se répète ou si le bail se termine.",
          "La première relance peut rester factuelle : rappeler la période concernée, le montant attendu, l’échéance dépassée et demander confirmation du paiement. Si le retard continue, la formulation et le canal doivent être adaptés à la situation.",
          "Dès le premier impayé, le bailleur peut aussi vérifier les garanties prévues au bail : caution personne physique, Visale, assurance loyers impayés ou autre dispositif. Chaque garantie a ses propres délais et justificatifs.",
        ],
        bullets: [
          "Date de relance enregistrée.",
          "Canal conservé : email, courrier, message.",
          "Montant et période rappelés.",
          "Réponse du locataire archivée.",
          "Garantie vérifiée si le retard persiste.",
        ],
      },
      {
        title: "4. Relier suivi des loyers et quittances",
        body: [
          "Dans lokt.fr, le suivi des loyers sert aussi à décider si une quittance peut être générée ou s’il faut attendre une confirmation de paiement.",
          "La quittance atteste le paiement complet du loyer et des charges pour la période concernée. Si le mois n’est pas soldé, la quittance doit rester bloquée pour éviter de produire un document incohérent.",
          "Ce lien entre paiement et quittance évite une erreur fréquente : envoyer un PDF parce que le mois est passé, alors que le montant réellement encaissé ne correspond pas au montant attendu.",
        ],
        bullets: [
          "Paiement complet confirmé.",
          "PDF généré uniquement si le solde est à zéro.",
          "Reçu séparé si paiement partiel.",
          "Finance mise à jour avec les montants reçus.",
          "Archive par bail et par mois.",
        ],
      },
      {
        title: "5. Préparer un dossier clair si la situation se dégrade",
        body: [
          "Si l’impayé persiste, le bailleur doit pouvoir retrouver rapidement le bail, la clause résolutoire éventuelle, les coordonnées du garant, les relances, les paiements reçus, les quittances émises et les justificatifs.",
          "Le but de l’outil n’est pas de remplacer un conseil juridique, mais de ne pas perdre les faits. Un dossier bien tenu facilite l’échange avec le locataire, le garant, une assurance, un conciliateur ou un professionnel.",
          "Il faut aussi éviter les mélanges : le dépôt de garantie ne doit pas être utilisé comme un loyer ordinaire, et les charges doivent rester distinctes du loyer hors charges.",
        ],
        bullets: [
          "Bail et garanties disponibles.",
          "Historique des paiements exportable.",
          "Relances datées.",
          "Solde restant dû lisible.",
          "Quittances et reçus séparés.",
          "Pièces conservées pour chaque période.",
        ],
      },
    ],
    faq: [
      { q: "Faut-il générer une quittance en cas de retard ?", a: "Non, la quittance complète suppose que le loyer et les charges de la période soient payés intégralement." },
      { q: "Quand relancer ?", a: "Le bon moment dépend du bail et de la situation, mais le retard doit être détecté rapidement, qualifié et documenté dès le début." },
      { q: "Que faire en cas de paiement partiel ?", a: "Il faut enregistrer la somme reçue, conserver le solde restant dû et éviter la quittance complète tant que la période n’est pas soldée." },
      { q: "Faut-il contacter le garant dès le premier impayé ?", a: "Cela dépend de la garantie prévue au bail et de ses conditions. Il faut surtout vérifier rapidement les délais, justificatifs et modalités applicables." },
      { q: "Un tableur suffit-il ?", a: "Il peut suffire au début, mais il devient fragile dès qu’il y a plusieurs baux, paiements partiels, relances, garanties ou quittances à bloquer." },
    ],
    links: [
      { label: "Modèle quittance PDF", href: "/modele-quittance-loyer-pdf", text: "Comprendre le lien entre paiement confirmé et quittance." },
      { label: "Caution et loyers", href: "/cautions-loyers", text: "Dépôt de garantie, caution et suivi des sommes dues." },
      { label: "Service-Public : paiement du loyer", href: "https://www.service-public.fr/particuliers/vosdroits/F1214", text: "Vérifier les règles générales sur paiement, quittance et impayés." },
      { label: "Service-Public : loyers impayés", href: "https://www.service-public.fr/particuliers/vosdroits/F31272", text: "Comprendre les démarches possibles en cas d’impayés persistants." },
    ],
  },
  {
    slug: "inventaire-location-meublee",
    title: "Inventaire location meublée",
    metaTitle: "Inventaire location meublée : checklist | lokt.fr",
    description:
      "Préparer l’inventaire d’une location meublée : mobilier obligatoire, état des équipements, photos, signature, état des lieux et restitution.",
    eyebrow: "Location meublée",
    h1: "Inventaire de location meublée : checklist obligatoire",
    intro:
      "L’inventaire d’une location meublée décrit les meubles et équipements remis au locataire. Il complète l’état des lieux, prouve ce qui a été mis à disposition et sécurise la restitution du logement. Sans inventaire clair, le départ du locataire devient vite une discussion de mémoire.",
    primaryCta: "Préparer mon inventaire",
    secondaryCta: { label: "Guide LMNP", href: "/guides/lmnp-checklist-location-meublee" },
    updatedAt: today,
    intent: "Requête cible : inventaire location meublée obligatoire",
    sections: [
      {
        title: "1. À quoi sert l’inventaire meublé ?",
        body: [
          "L’inventaire sert à identifier les équipements présents dans le logement au moment de l’entrée. Il indique ce qui est remis au locataire, en quelle quantité et dans quel état.",
          "Il ne doit pas être confondu avec une simple liste décorative. Pour un meublé, il permet de vérifier que le logement est réellement équipé pour une occupation normale et de comparer la situation à la sortie.",
          "Il protège les deux parties : le bailleur peut prouver les éléments confiés, et le locataire peut signaler dès l’entrée un meuble usé, manquant ou déjà détérioré.",
        ],
        bullets: [
          "Identifier les meubles remis.",
          "Décrire l’état de chaque élément.",
          "Compléter l’état des lieux.",
          "Préparer la comparaison à la sortie.",
          "Documenter les remplacements.",
          "Éviter les discussions imprécises.",
        ],
      },
      {
        title: "2. Les équipements à contrôler pièce par pièce",
        body: [
          "L’inventaire doit permettre de vérifier les équipements indispensables : couchage, cuisine, rangement, éclairage, entretien et équipements de vie courante. Le plus simple est de le faire pièce par pièce.",
          "Dans la cuisine, détaillez les plaques, four ou micro-ondes, réfrigérateur, vaisselle, ustensiles, casseroles et petit équipement utile. Dans la chambre, indiquez literie, couette ou couverture, occultation et rangements.",
          "Pour les éléments nombreux, évitez les formulations vagues. “Vaisselle complète” est moins utile que “12 assiettes plates, 12 verres, 12 fourchettes, 12 couteaux”.",
        ],
        bullets: [
          "Literie avec couette ou couverture.",
          "Occultation des fenêtres des pièces de sommeil.",
          "Plaques de cuisson.",
          "Four ou four à micro-ondes.",
          "Réfrigérateur et compartiment congélation si nécessaire.",
          "Vaisselle et ustensiles.",
          "Table, sièges et rangements.",
          "Luminaires.",
          "Matériel d’entretien adapté.",
        ],
      },
      {
        title: "3. Décrire l’état sans ambiguïté",
        body: [
          "Chaque élément important doit être décrit avec un état clair : neuf, très bon état, bon état, usure normale, rayé, taché, cassé, incomplet ou à remplacer. L’objectif n’est pas de dramatiser, mais d’éviter une zone floue.",
          "Les photos sont utiles lorsqu’elles documentent un défaut, un équipement coûteux ou une pièce complète. Elles doivent être conservées avec le bail et idéalement rattachées à la ligne d’inventaire correspondante.",
          "Si vous remplacez un meuble pendant le bail, mettez l’inventaire à jour : date d’ajout, facture éventuelle, photo, ancien équipement retiré et état du nouveau.",
        ],
        bullets: [
          "Quantité précise.",
          "Marque ou référence si utile.",
          "État initial.",
          "Photo pour les éléments sensibles.",
          "Coût ou facture si pertinent.",
          "Mise à jour après remplacement.",
        ],
      },
      {
        title: "4. Le relier à l’état des lieux",
        body: [
          "L’inventaire et l’état des lieux doivent être cohérents. Un canapé listé dans l’inventaire mais non décrit dans l’état du logement crée une zone floue au départ du locataire.",
          "L’état des lieux décrit l’état du logement et de ses équipements ; l’inventaire détaille les meubles et objets remis. Les deux documents doivent être signés, datés et conservés ensemble.",
          "Au départ, la comparaison doit se faire entre les documents d’entrée et de sortie. Sans document d’entrée exploitable, une retenue sur dépôt de garantie devient beaucoup plus fragile.",
        ],
        bullets: [
          "Inventaire signé à l’entrée.",
          "État des lieux signé séparément ou annexé.",
          "Photos conservées au même endroit.",
          "Comparaison préparée pour la sortie.",
          "Retenues justifiables uniquement si documentées.",
        ],
      },
      {
        title: "5. Utiliser l’inventaire pour piloter le logement",
        body: [
          "Un inventaire ne sert pas seulement au litige. Il aide aussi à piloter le budget de remplacement, la conformité du meublé et la préparation d’un changement de locataire.",
          "Dans lokt.fr, l’inventaire peut devenir une liste vivante : éléments obligatoires LMNP, quantités, état, coût de remplacement, photos, notes et actions à prévoir.",
          "Cette logique évite de refaire l’inventaire de zéro à chaque relocation et permet de préparer les achats avant l’arrivée du prochain locataire.",
        ],
        bullets: [
          "Suivi des éléments obligatoires.",
          "Budget de remplacement.",
          "Équipements manquants détectés.",
          "Photos centralisées.",
          "Historique des remplacements.",
          "Préparation plus rapide de la relocation.",
        ],
      },
    ],
    faq: [
      { q: "L’inventaire est-il obligatoire en meublé ?", a: "Oui, l’inventaire du mobilier accompagne la location meublée. Il permet de prouver les équipements remis et leur état." },
      { q: "Faut-il mettre les prix d’achat ?", a: "Ce n’est pas toujours indispensable pour la relation locative, mais cela peut aider à documenter les remplacements, les équipements coûteux et le dossier du bien." },
      { q: "Les photos suffisent-elles ?", a: "Non, les photos complètent une liste écrite, datée et signée. Elles ne remplacent pas l’inventaire." },
      { q: "Faut-il refaire l’inventaire à chaque locataire ?", a: "Il faut au minimum le vérifier, le mettre à jour et le faire signer à chaque nouvelle entrée dans les lieux." },
      { q: "Que faire si un meuble est remplacé pendant le bail ?", a: "Ajoutez une note datée, conservez la facture si utile et mettez à jour l’inventaire avec l’état du nouvel équipement." },
    ],
    links: [
      { label: "Gestion LMNP", href: "/gestion-locative-lmnp", text: "Relier inventaire, bail, quittances et finance." },
      { label: "État des lieux", href: "/etats-des-lieux-documents", text: "Préparer l’entrée et la sortie du locataire." },
      { label: "Service-Public : mobilier meublé", href: "https://www.service-public.fr/particuliers/vosdroits/F34769", text: "Vérifier les équipements nécessaires en location meublée." },
      { label: "Service-Public : état des lieux", href: "https://www.service-public.fr/particuliers/vosdroits/F31270", text: "Comprendre le rôle de l’état des lieux d’entrée." },
    ],
  },
  {
    slug: "revision-loyer-irl",
    title: "Révision de loyer IRL",
    metaTitle: "Calcul révision loyer IRL pour bailleur | lokt.fr",
    description:
      "Calculer une révision annuelle de loyer avec l’IRL : clause du bail, date d’effet, formule, exemple, DPE, message au locataire et sources officielles.",
    eyebrow: "Révision du loyer",
    h1: "Calcul de révision du loyer avec l’IRL",
    intro:
      "La révision annuelle du loyer n’est pas une hausse automatique. Elle doit être prévue par le bail, respecter l’indice de référence des loyers et tenir compte des restrictions applicables au logement.",
    primaryCta: "Suivre mes échéances de bail",
    updatedAt: today,
    intent: "Requête cible : calcul révision loyer IRL",
    sections: [
      {
        title: "1. Vérifier si la révision est possible",
        body: [
          "Pour un logement loué vide ou meublé avec un bail d’habitation, l’IRL sert de plafond à la révision annuelle du loyer. Mais le bailleur ne peut pas l’appliquer librement : le bail doit prévoir une clause de révision.",
          "Relisez le bail avant tout calcul. La clause indique souvent une date de révision et un trimestre de référence. Si le trimestre n’est pas indiqué, on retient en pratique le dernier IRL publié par l’Insee à la date de signature du bail.",
          "La révision porte sur le loyer hors charges. Les provisions de charges, forfaits de charges et régularisations ne se recalculent pas avec la formule IRL.",
        ],
        bullets: [
          "Clause de révision présente dans le bail.",
          "Date annuelle de révision identifiée.",
          "Trimestre IRL de référence identifié.",
          "Loyer hors charges utilisé comme base.",
          "DPE et restrictions éventuelles vérifiés.",
          "Information claire envoyée au locataire.",
        ],
      },
      {
        title: "2. Appliquer la bonne formule IRL",
        body: [
          "La formule à utiliser est : nouveau loyer hors charges = loyer hors charges actuel × nouvel IRL ÷ ancien IRL.",
          "Le nouvel IRL est l’indice publié pour le même trimestre que celui retenu dans le bail, mais à l’année de révision. L’ancien IRL est l’indice du même trimestre l’année précédente, ou l’indice de référence utilisé lors de la dernière révision.",
          "Exemple : pour un loyer hors charges de 750 €, avec un ancien IRL à 140,00 et un nouvel IRL à 145,00, le calcul donne 750 × 145 ÷ 140 = 776,79 €. Le loyer révisé hors charges est donc de 776,79 €, avant ajout des charges.",
        ],
        bullets: [
          "Ne pas appliquer l’IRL sur les charges.",
          "Comparer le même trimestre d’une année à l’autre.",
          "Conserver les deux indices utilisés.",
          "Archiver le détail du calcul avec le bail.",
        ],
      },
      {
        title: "3. Respecter le délai et la date d’effet",
        body: [
          "Le bailleur peut appliquer la révision dans l’année qui suit la date de révision prévue au bail. S’il laisse passer ce délai, il perd le bénéfice de la révision non demandée pour l’année écoulée.",
          "Lorsque la demande est faite après la date annuelle prévue mais dans le délai d’un an, la révision ne s’applique pas rétroactivement sur les mois déjà passés : elle prend effet à compter de la demande.",
          "En pratique, il est préférable d’envoyer l’information au locataire autour de la date anniversaire, avec le loyer avant révision, le nouvel indice, l’ancien indice, la formule et la date d’application.",
        ],
        bullets: [
          "Contrôler la date de révision du bail.",
          "Ne pas réclamer rétroactivement des mois non demandés.",
          "Envoyer une notification écrite et archivable.",
          "Mettre à jour le montant attendu dans le suivi des loyers.",
        ],
      },
      {
        title: "4. Vérifier les limites avant toute hausse",
        body: [
          "Certaines situations peuvent empêcher ou limiter la révision, notamment la performance énergétique du logement. Les logements classés F ou G peuvent être concernés par une interdiction de révision selon la date du bail, son renouvellement ou sa reconduction, et selon le territoire.",
          "Il faut aussi tenir compte des règles locales applicables, notamment dans les zones d’encadrement des loyers ou lorsqu’un dispositif spécifique s’applique au logement.",
          "Si le bien est dans une situation particulière, ne vous contentez pas de la formule mathématique : vérifiez la règle officielle applicable avant d’écrire au locataire.",
        ],
        bullets: [
          "DPE contrôlé avant demande.",
          "Zone d’encadrement ou règle locale vérifiée.",
          "Bail commercial exclu de cette page.",
          "Cas fiscal ou juridique sensible validé avec un professionnel.",
        ],
      },
      {
        title: "5. Message type à envoyer au locataire",
        body: [
          "Exemple de formulation : « Conformément à la clause de révision prévue au bail signé le [date], le loyer hors charges est révisé selon l’indice de référence des loyers du [trimestre]. Ancien loyer hors charges : [montant]. Ancien IRL : [indice]. Nouvel IRL : [indice]. Nouveau loyer hors charges à compter du [date] : [montant]. »",
          "Ajoutez ensuite le montant des charges séparément pour indiquer le total mensuel à payer. Conservez une copie de ce message dans le dossier du bail.",
          "Dans lokt.fr, l’objectif est de rattacher ce type d’échéance au bail pour éviter d’oublier la date anniversaire, le trimestre de référence ou la preuve du calcul.",
        ],
      },
    ],
    faq: [
      { q: "Peut-on réviser sans clause dans le bail ?", a: "En principe non : la révision doit être prévue par le contrat." },
      { q: "La révision porte-t-elle sur les charges ?", a: "La révision IRL concerne le loyer hors charges, pas les provisions ou forfaits de charges." },
      { q: "Faut-il prévenir le locataire ?", a: "Oui, il faut communiquer clairement le nouveau loyer, l’ancien indice, le nouvel indice, la formule et la date d’application." },
      { q: "Peut-on réclamer une révision oubliée plusieurs années après ?", a: "Non. La révision doit être demandée dans l’année qui suit la date prévue. Une demande tardive ne permet pas de rattraper rétroactivement plusieurs années." },
      { q: "Où trouver les indices IRL ?", a: "Les indices sont publiés chaque trimestre par l’Insee. Utilisez l’indice correspondant au trimestre prévu dans le bail." },
    ],
    links: [
      { label: "Indices IRL Insee", href: "https://www.insee.fr/fr/statistiques/serie/001515333", text: "Consulter les indices officiels publiés par l’Insee." },
      { label: "Service-Public", href: "https://www.service-public.fr/particuliers/vosdroits/F13723", text: "Vérifier les règles officielles de révision d’un loyer d’habitation." },
      { label: "Baux et suivi", href: "/outil-gestion-locative", text: "Créer des rappels de bail et conserver l’historique." },
    ],
  },
  {
    slug: "depot-garantie-location-meublee",
    title: "Dépôt de garantie en location meublée",
    metaTitle: "Dépôt de garantie location meublée | lokt.fr",
    description:
      "Comprendre le dépôt de garantie en location meublée : montant maximal, état des lieux, inventaire, restitution, retenues possibles et justificatifs.",
    eyebrow: "Départ locataire",
    h1: "Dépôt de garantie en location meublée : restitution et retenues",
    intro:
      "Le dépôt de garantie est souvent source de tension au départ. En location meublée, le bailleur doit s’appuyer sur le bail, l’état des lieux, l’inventaire et les justificatifs pour restituer la bonne somme, dans le bon délai, sans confondre usure normale, dégradation et dette locative.",
    primaryCta: "Préparer un départ locataire",
    secondaryCta: { label: "Voir le suivi caution", href: "/cautions-loyers" },
    updatedAt: today,
    intent: "Requête cible : restitution dépôt de garantie location meublée",
    sections: [
      {
        title: "1. Montant et suivi du dépôt de garantie",
        body: [
          "En location meublée à usage de résidence principale, le dépôt de garantie peut aller jusqu’à deux mois de loyer hors charges lorsque le bail en prévoit un. Il doit être suivi séparément du loyer et des charges.",
          "Le dépôt de garantie n’est pas un dernier mois de loyer. Le locataire reste tenu de payer les loyers et charges jusqu’à la fin de ses obligations, même si une somme a été versée à l’entrée.",
          "Dès la signature, conservez le montant, la date d’encaissement, le bail concerné et les conditions de restitution. Cela évite de reconstruire l’information au moment du départ.",
        ],
        bullets: [
          "Montant inscrit dans le bail.",
          "Maximum lié au loyer hors charges.",
          "Encaissement suivi à part.",
          "Non imputé automatiquement sur le dernier loyer.",
          "Rattaché au bon bail.",
          "Restitution anticipée dans le dossier de départ.",
        ],
      },
      {
        title: "2. Les documents qui font foi",
        body: [
          "La comparaison entre l’état des lieux d’entrée et l’état des lieux de sortie est centrale. En meublé, l’inventaire signé complète cette analyse pour les équipements remis au locataire.",
          "Les photos, factures, devis, échanges et signalements de travaux peuvent aussi aider, mais ils doivent être rattachés au bon logement et à la bonne période.",
          "Sans état des lieux d’entrée exploitable ou inventaire clair, il devient difficile de justifier une retenue liée à un meuble manquant, cassé ou à une dégradation.",
        ],
        bullets: [
          "Bail signé.",
          "État des lieux d’entrée.",
          "Inventaire du mobilier.",
          "État des lieux de sortie.",
          "Photos datées si utiles.",
          "Devis ou factures.",
          "Relances de loyers impayés.",
          "Justificatifs de charges.",
        ],
      },
      {
        title: "3. Retenues : rester documenté",
        body: [
          "Une retenue doit correspondre à une dégradation, une dette locative ou une charge justifiable, pas à une impression générale. Les justificatifs évitent de transformer le départ en litige.",
          "L’usure normale liée au temps ne se traite pas comme une dégradation imputable au locataire. Un canapé usé normalement après plusieurs années n’est pas la même chose qu’un canapé brûlé ou cassé.",
          "En meublé, l’inventaire aide à qualifier les manquants : télécommande absente, vaisselle incomplète, chaise cassée, literie détériorée ou électroménager non restitué dans l’état prévu.",
        ],
        bullets: [
          "Dégradation comparée aux documents d’entrée.",
          "Dette de loyer ou charges impayées.",
          "Charge récupérable justifiée.",
          "Mobilier manquant ou détérioré.",
          "Vétusté distinguée de la dégradation.",
          "Montant appuyé par devis ou facture.",
        ],
      },
      {
        title: "4. Délais de restitution",
        body: [
          "Le délai de restitution dépend notamment de la comparaison entre l’état des lieux d’entrée et l’état des lieux de sortie. Lorsque la sortie est conforme à l’entrée, le délai est plus court ; lorsque des différences existent, le bailleur dispose de davantage de temps pour chiffrer et justifier les retenues.",
          "Le point de départ pratique est la restitution des clés. Il faut donc conserver la date de remise des clés et clôturer le dossier de sortie avec les documents signés.",
          "Si une retenue est effectuée, le locataire doit pouvoir comprendre ce qui est retenu, pourquoi, et sur quel justificatif.",
        ],
        bullets: [
          "Date de remise des clés conservée.",
          "États des lieux comparés.",
          "Retenues expliquées.",
          "Justificatifs transmis ou conservés.",
          "Solde restitué dans le délai applicable.",
        ],
      },
      {
        title: "5. Préparer le départ dans lokt.fr",
        body: [
          "Un départ bien préparé commence avant le rendez-vous de sortie : retrouver le bail, l’état des lieux d’entrée, l’inventaire, les quittances, les paiements et les signalements travaux.",
          "Dans lokt.fr, le bailleur peut garder le dépôt de garantie dans le même dossier que le bail, mais séparé des loyers. Cela permet de voir rapidement ce qui relève du dépôt, d’un impayé, d’une charge ou d’une réparation.",
          "La bonne logique est simple : comparer, qualifier, justifier, restituer, puis archiver la clôture du bail.",
        ],
        bullets: [
          "Bail et dépôt retrouvés.",
          "Inventaire comparé.",
          "Paiements vérifiés.",
          "Retenues préparées.",
          "Restitution tracée.",
          "Bail clôturé proprement.",
        ],
      },
    ],
    faq: [
      { q: "Quel est le montant maximal en location meublée ?", a: "Pour une location meublée à usage de résidence principale, le dépôt de garantie peut atteindre deux mois de loyer hors charges si le bail le prévoit." },
      { q: "Peut-on utiliser le dépôt pour le dernier mois de loyer ?", a: "Non. Le dépôt de garantie n’est pas un loyer d’avance ; le locataire doit continuer à payer les loyers et charges dus." },
      { q: "Peut-on retenir pour usure normale ?", a: "L’usure normale liée au temps ne se traite pas comme une dégradation imputable au locataire." },
      { q: "L’inventaire sert-il au dépôt de garantie ?", a: "Oui, il aide à vérifier les meubles et équipements remis en début de bail, surtout en location meublée." },
      { q: "Faut-il des justificatifs ?", a: "Oui, les retenues doivent être justifiées par des éléments concrets : états des lieux, photos, devis, factures, loyers impayés ou charges justifiables." },
      { q: "Quand commence le délai de restitution ?", a: "Le délai se calcule à partir de la restitution des clés. Il faut donc conserver cette date dans le dossier de sortie." },
    ],
    links: [
      { label: "Caution et dépôt de garantie", href: "/cautions-loyers", text: "Page complète sur les garanties et sommes à suivre." },
      { label: "Inventaire meublé", href: "/inventaire-location-meublee", text: "Préparer les preuves utiles pour comparer les meubles à la sortie." },
      { label: "État des lieux de sortie", href: "/guides/depart-locataire-etat-des-lieux-sortie", text: "Préparer le départ et comparer les états." },
      { label: "Service-Public : dépôt de garantie", href: "https://www.service-public.fr/particuliers/vosdroits/F31269", text: "Vérifier les délais, retenues et règles officielles de restitution." },
    ],
  },
  {
    slug: "modele-lettre-conge-bailleur",
    title: "Modèle lettre de congé bailleur 2026 — Reprise, vente, motif légitime",
    metaTitle: "Modèle lettre de congé bailleur 2026 : reprise, vente, motif légitime | lokt.fr",
    description:
      "Rédigez votre lettre de congé bailleur conforme à la loi du 6 juillet 1989 : reprise pour habiter, vente du logement, motif légitime. Délais, forme obligatoire, modèles complets et générateur PDF.",
    eyebrow: "Congé bailleur",
    h1: "Lettre de congé bailleur : modèle 2026 conforme à la loi",
    intro:
      "Un bailleur ne peut pas mettre fin à un bail d'habitation à tout moment. La loi du 6 juillet 1989 impose un motif précis parmi trois autorisés, un délai strict à respecter à partir de la réception par le locataire, et une forme obligatoire — lettre recommandée avec accusé de réception, remise en main propre contre signature, ou acte d'huissier. Un congé mal rédigé ou envoyé hors délai est nul de plein droit : le locataire reste en place pour une nouvelle période complète.",
    primaryCta: "Générer ma lettre de congé en PDF",
    secondaryCta: { label: "Voir les modèles de lettres", href: "/modele-lettre-conge-bailleur#modeles" },
    updatedAt: today,
    intent: "Requête cible : lettre de congé bailleur modèle, congé pour reprise vente motif légitime",
    sections: [
      {
        title: "1. Les 3 seuls motifs légaux autorisés",
        body: [
          "L'article 15 de la loi du 6 juillet 1989 est limitatif : seuls trois motifs permettent à un bailleur de donner congé à son locataire occupant sa résidence principale. Tout autre motif rend le congé nul de plein droit.",
          "Le motif de reprise pour habiter permet au bailleur de récupérer le logement pour y habiter lui-même ou pour y loger un proche. Le bénéficiaire doit obligatoirement appartenir à la liste légale : le bailleur lui-même, son conjoint, partenaire de PACS ou concubin notoire, ses ascendants ou descendants, ou ceux de son conjoint ou partenaire.",
          "Le motif de vente permet au bailleur de vendre le logement libre. Le locataire bénéficie alors d'un droit de préemption : il peut acheter en priorité aux conditions indiquées dans le congé. La lettre doit reproduire intégralement les cinq premiers alinéas du II de l'article 15 relatifs à ce droit.",
          "Le motif légitime et sérieux couvre notamment les loyers impayés répétés, les troubles de voisinage constatés par décision de justice, la transformation non autorisée du logement ou le non-respect grave des obligations locataires. Le motif doit être décrit précisément dans la lettre.",
        ],
        bullets: [
          "Reprise pour habiter : le bailleur ou un proche éligible y vit effectivement après la restitution",
          "Vente du logement : droit de préemption du locataire à reproduire intégralement dans la lettre",
          "Motif légitime et sérieux : impayés, troubles, dégradations — motif précisément décrit",
          "Tout autre motif = congé nul, le locataire reste en place",
        ],
      },
      {
        title: "2. Délais de préavis à respecter impérativement",
        body: [
          "Le délai de préavis court à partir de la date de réception du courrier recommandé par le locataire, pas de la date d'envoi. En pratique, il faut envoyer avec 8 à 10 jours d'avance pour absorber les délais postaux et éviter tout litige sur la date.",
          "Pour une location vide à usage de résidence principale, le préavis est de six mois avant la date d'échéance du bail. Pour une location meublée à usage de résidence principale, le préavis est de trois mois. Les bails mobilité et étudiants 9 mois ne sont pas renouvelables, aucun congé formel n'est nécessaire.",
          "Un congé reçu par le locataire avec un seul jour de moins que le délai légal est nul. Il n'existe aucune tolérance légale, même si le locataire ne conteste pas immédiatement. L'irrespect du délai reporte la fin du bail d'un an complet pour un meublé, et de trois ans pour un logement vide.",
        ],
        bullets: [
          "Location vide (résidence principale) : 6 mois de préavis minimum",
          "Location meublée (résidence principale) : 3 mois de préavis minimum",
          "Délai calculé à partir de la réception — pas de l'envoi",
          "Un jour de retard = bail reconduit pour une période complète",
        ],
      },
      {
        title: "3. Forme obligatoire de l'envoi",
        body: [
          "Un email, un SMS ou une lettre simple n'ont aucune valeur juridique pour un congé bailleur. La loi impose exclusivement trois modes de remise : la lettre recommandée avec accusé de réception, la remise en main propre contre émargement ou récépissé signé par le locataire, ou la signification par acte d'huissier.",
          "La lettre recommandée avec accusé de réception est la solution la plus courante. Si le locataire ne retire pas le courrier, la date de première présentation à sa boîte aux lettres fait quand même foi — le délai commence à courir. Conservez le bordereau d'envoi et l'accusé de réception.",
          "L'acte d'huissier est recommandé dans les situations conflictuelles. L'huissier atteste de la remise et de sa date avec une valeur probante incontestable.",
        ],
        bullets: [
          "Lettre recommandée avec AR : solution la plus courante, date de présentation fait foi",
          "Remise en main propre : contre émargement ou récépissé signé",
          "Acte d'huissier : pour situations conflictuelles, preuve incontestable",
          "Email / courrier simple : aucune valeur juridique",
        ],
      },
      {
        title: "4. Contenu obligatoire de la lettre selon le motif",
        body: [
          "Pour un congé pour reprise, la lettre doit indiquer le motif explicite, le nom et l'adresse actuelle du bénéficiaire de la reprise, et son lien de parenté précis avec le bailleur. Un congé pour reprise au profit d'un ami ou d'un cousin est nul — seuls les proches listés par la loi sont éligibles.",
          "Pour un congé pour vente, la lettre doit mentionner le prix et les conditions de vente envisagées, et reproduire intégralement les cinq premiers alinéas du II de l'article 15 de la loi du 6 juillet 1989 relatifs au droit de préemption. Sans ces alinéas reproduits, le congé est nul.",
          "Pour un motif légitime et sérieux, la lettre doit décrire précisément les faits reprochés avec dates et références si disponibles. Une formulation vague comme « troubles répétés » sans détails est insuffisante et expose le congé à la nullité.",
        ],
        bullets: [
          "Reprise : nom, adresse actuelle et lien de parenté du bénéficiaire",
          "Vente : prix, conditions et reproduction des 5 alinéas sur le droit de préemption",
          "Motif légitime : faits précis, datés, documentés",
          "Adresse et identité complète du bailleur et du locataire",
        ],
      },
      {
        title: "5. Erreurs qui invalident le congé",
        body: [
          "Les erreurs les plus fréquentes portent sur le délai, le motif et la forme. Un congé envoyé un jour trop tard est nul. Un congé pour reprise sans nommer le bénéficiaire est nul. Un congé par email est nul. Ces nullités peuvent être invoquées même plusieurs années après si le locataire n'a pas quitté les lieux.",
          "Le bailleur qui donne congé pour reprise et ne reprend pas effectivement le logement dans les six mois suivant la restitution des clés s'expose à une amende pénale pouvant atteindre 6 000 € pour une personne physique, ainsi qu'à des dommages et intérêts au bénéfice du locataire.",
          "Les locataires de plus de 65 ans dont les ressources sont inférieures au plafond applicable aux logements conventionnés bénéficient d'une protection renforcée : le bailleur doit leur proposer un relogement adapté dans le même secteur géographique, sauf si le bailleur lui-même répond aux mêmes critères d'âge ou de ressources.",
        ],
        bullets: [
          "Délai non respecté même d'un seul jour : congé nul, bail reconduit",
          "Bénéficiaire non éligible pour la reprise : congé nul",
          "Droit de préemption absent dans un congé pour vente : congé nul",
          "Fausse reprise : amende jusqu'à 6 000 € + dommages et intérêts",
          "Locataire de plus de 65 ans à faibles ressources : protection renforcée",
        ],
      },
      {
        title: "6. Générer sa lettre de congé avec lokt.fr",
        body: [
          "Depuis la section Modèles de l'espace bailleur lokt.fr, vous pouvez générer votre lettre de congé en renseignant les informations nécessaires selon le motif choisi. La lettre est générée en PDF, datée, et prête à être imprimée et envoyée en recommandé avec accusé de réception.",
          "Le formulaire guide le bailleur selon le motif sélectionné : champs bénéficiaire pour la reprise, prix et droit de préemption pour la vente, description précise pour le motif légitime. Le rappel du délai applicable est affiché selon le type de bail.",
        ],
        bullets: [
          "Formulaire guidé selon le motif : reprise, vente ou motif légitime",
          "Rappel automatique du délai de préavis applicable",
          "PDF généré instantanément, prêt à imprimer",
          "Accès depuis la section Modèles de l'espace bailleur",
        ],
      },
    ],
    faq: [
      {
        q: "Quels sont les motifs légaux pour donner congé à son locataire ?",
        a: "La loi du 6 juillet 1989 n'autorise que trois motifs : la reprise du logement pour y habiter (ou y loger un proche éligible), la vente du logement, ou un motif légitime et sérieux (loyers impayés répétés, troubles constatés, non-respect grave des obligations). Un congé donné sans motif valable est nul.",
      },
      {
        q: "Quel est le délai de préavis pour un congé bailleur ?",
        a: "Six mois avant la date de fin du bail pour une location vide à usage de résidence principale. Trois mois pour une location meublée à usage de résidence principale. Ce délai court à partir de la date de réception par le locataire, pas de l'envoi. Un envoi en recommandé 8 à 10 jours avant suffit en pratique.",
      },
      {
        q: "Comment envoyer le congé bailleur ?",
        a: "Par lettre recommandée avec accusé de réception, par remise en main propre contre émargement ou récépissé signé, ou par acte d'huissier. Un email ou un courrier simple n'a aucune valeur juridique pour un congé bailleur.",
      },
      {
        q: "Que doit contenir une lettre de congé pour reprise ?",
        a: "Le motif précis (reprise pour habiter), le nom complet et l'adresse actuelle du bénéficiaire, et son lien de parenté avec le bailleur. Le bénéficiaire doit être le bailleur lui-même, son conjoint, partenaire de PACS, concubin notoire, ses ascendants ou descendants, ou ceux du conjoint ou partenaire.",
      },
      {
        q: "Le locataire peut-il contester le congé pour reprise ?",
        a: "Oui. Si le bailleur ne reprend pas effectivement le logement dans les six mois suivant la restitution des clés, ou si la reprise ne bénéficie pas à la personne désignée, le locataire peut saisir le tribunal. Le bailleur risque une amende pénale jusqu'à 6 000 € et des dommages et intérêts.",
      },
      {
        q: "Que doit contenir un congé pour vente ?",
        a: "Le prix et les conditions de vente envisagés, et la reproduction intégrale des cinq premiers alinéas du II de l'article 15 de la loi du 6 juillet 1989 relatifs au droit de préemption du locataire. Sans ces alinéas reproduits dans la lettre, le congé est nul.",
      },
      {
        q: "Le locataire a-t-il un droit de préemption en cas de vente ?",
        a: "Oui. À compter de la réception du congé-vente, le locataire dispose de deux mois pour accepter d'acheter en priorité aux conditions indiquées. S'il accepte, il a ensuite deux mois pour réaliser la vente (quatre mois s'il recourt à un prêt immobilier).",
      },
      {
        q: "Que se passe-t-il si le congé est envoyé un jour trop tard ?",
        a: "Le bail est reconduit tacitement pour une nouvelle période complète : trois ans pour un bail vide, un an pour un bail meublé. Il n'y a aucune tolérance légale sur les délais, même si le locataire ne conteste pas immédiatement.",
      },
      {
        q: "Un locataire de plus de 65 ans bénéficie-t-il d'une protection spéciale ?",
        a: "Oui. Un locataire de plus de 65 ans dont les ressources sont inférieures au plafond applicable aux logements locatifs conventionnés bénéficie d'une protection renforcée : le bailleur doit lui proposer un relogement adapté dans le même secteur géographique, sauf si le bailleur lui-même a plus de 65 ans ou des ressources inférieures au même plafond.",
      },
      {
        q: "Le locataire peut-il partir avant la fin du préavis ?",
        a: "Oui. Dès réception du congé, le locataire peut quitter le logement à tout moment avant la date effective de fin de bail. Il ne paie le loyer et les charges que jusqu'à la date effective de remise des clés.",
      },
    ],
    links: [
      {
        label: "Espace bailleur lokt.fr",
        href: "/espace-bailleur",
        text: "Gérer vos baux, loyers et documents depuis un seul espace.",
      },
      {
        label: "Modèle quittance de loyer PDF",
        href: "/modele-quittance-loyer-pdf",
        text: "Générer vos quittances mensuelles en PDF.",
      },
      {
        label: "États des lieux et documents",
        href: "/etats-des-lieux-documents",
        text: "Réaliser et archiver états des lieux d'entrée et de sortie.",
      },
      {
        label: "Dépôt de garantie location meublée",
        href: "/depot-garantie-location-meublee",
        text: "Règles de restitution et retenues autorisées.",
      },
    ],
  },
];

export function getSeoLandingPage(slug: string) {
  return SEO_LANDING_PAGES.find((page) => page.slug === slug) || null;
}
