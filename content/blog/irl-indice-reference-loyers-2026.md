---
title: "IRL 2026 : indice de référence des loyers (INSEE)"
h1: "IRL 2026 : l'indice officiel de l'INSEE pour réviser un loyer, calcul et valeurs à jour"
description: "Valeur actuelle de l'IRL publiée par l'INSEE, comment calculer la révision annuelle de votre loyer, délais légaux et règles en zone d'encadrement."
date: "2026-06-28"
updatedAt: "2026-10-06"
category: "Gestion locative"
tags: ["IRL", "révision loyer", "indice référence loyers", "INSEE", "encadrement loyers", "bailleur"]
relatedCalculators: ["parc-immobilier"]
coverImage: "/blog/irl-revision-loyer.jpg"
irlLiveData: true
faq:
  - q: "Quelle est la valeur actuelle de l'IRL publiée par l'INSEE ?"
    a: "La dernière valeur publiée par l'INSEE est {{IRL_LATEST_VALUE}} pour le {{IRL_LATEST_LABEL}}, soit une évolution de {{IRL_EVOLUTION_PCT}} % sur un an par rapport au {{IRL_YEARAGO_LABEL}} ({{IRL_YEARAGO_VALUE}})."
  - q: "L'IRL peut-il être négatif et entraîner une baisse des loyers ?"
    a: "En théorie oui, si l'inflation est négative. En pratique, l'IRL n'a jamais été négatif depuis sa création en 2006 (source INSEE). La période Covid a vu des valeurs très faibles (+0,06 % en 2020), mais jamais de baisse."
  - q: "Mon locataire refuse la révision de loyer : que faire ?"
    a: "La clause de révision dans le bail est un droit légal du bailleur. Si le locataire refuse de payer le nouveau montant, il est en impayé partiel. Vous pouvez engager une procédure de mise en demeure, puis une procédure judiciaire si nécessaire."
  - q: "Puis-je appliquer la révision IRL si je n'ai pas notifié à temps ?"
    a: "Oui, mais elle s'applique à compter de la date de notification, pas rétroactivement depuis la date anniversaire. Si vous notifiez en octobre pour un bail dont la date anniversaire était en mars, la révision s'applique à partir d'octobre seulement."
  - q: "L'IRL s'applique-t-il aux baux mobilité et aux locations saisonnières ?"
    a: "Non. Les baux mobilité (1 à 10 mois) et les contrats de location saisonnière ne sont pas soumis à la révision IRL. Il s'applique uniquement aux locations à usage de résidence principale (vides ou meublées)."
  - q: "Que se passe-t-il si la clause de révision est absente du bail ?"
    a: "Sans clause de révision écrite dans le bail, vous ne pouvez pas réviser le loyer. Si cette clause est absente, le loyer reste figé pendant toute la durée du bail, quel que soit le niveau de l'IRL."
---

# IRL 2026 : l'indice officiel de l'INSEE pour réviser un loyer, calcul et valeurs à jour

L'**IRL (Indice de Référence des Loyers)** est publié chaque trimestre par l'**INSEE** (Institut national de la statistique et des études économiques) — c'est le seul index légalement autorisé pour réviser un loyer d'habitation en France (loi n° 89-462 du 6 juillet 1989, article 17-1). La dernière valeur publiée est **{{IRL_LATEST_VALUE}}** pour le **{{IRL_LATEST_LABEL}}**, en hausse de **{{IRL_EVOLUTION_PCT}} %** sur un an.

---

## Qu'est-ce que l'IRL, et qui le publie ?

L'IRL est calculé et publié par l'**INSEE**, chaque trimestre, à partir de l'évolution des prix à la consommation hors tabac et hors loyers (indice IPC). Il sert de référence légale unique pour la révision annuelle des loyers d'habitation en France.

**Caractéristiques :**
- Publié chaque trimestre (T1, T2, T3, T4) par l'INSEE, environ 6 semaines après la fin du trimestre concerné
- Basé sur l'évolution des prix à la consommation hors tabac et hors loyers
- Applicable aux **locations vides et meublées à usage de résidence principale**
- Ne s'applique pas aux baux commerciaux (qui utilisent l'ILAT ou l'ILC, deux indices distincts également publiés par l'INSEE)

---

## Valeur actuelle et historique de l'IRL

Source : INSEE, série BDM 001515333 (base 100 au premier trimestre 1998), mise à jour automatiquement dans cet article à chaque nouvelle publication.

| Trimestre | Valeur IRL | Évolution sur un an |
|-----------|-----------|-------------------|
| {{IRL_Q6_LABEL}} | {{IRL_Q6_VALUE}} | {{IRL_Q6_EVOL}} % |
| {{IRL_Q5_LABEL}} | {{IRL_Q5_VALUE}} | {{IRL_Q5_EVOL}} % |
| {{IRL_Q4_LABEL}} | {{IRL_Q4_VALUE}} | {{IRL_Q4_EVOL}} % |
| {{IRL_Q3_LABEL}} | {{IRL_Q3_VALUE}} | {{IRL_Q3_EVOL}} % |
| {{IRL_Q2_LABEL}} | {{IRL_Q2_VALUE}} | {{IRL_Q2_EVOL}} % |
| {{IRL_Q1_LABEL}} | {{IRL_Q1_VALUE}} | {{IRL_Q1_EVOL}} % |

> Vérifiez à tout moment la valeur en cours sur [insee.fr](https://www.insee.fr) — l'IRL est publié environ 6 semaines après la fin du trimestre concerné.

---

## Comment calculer la révision de votre loyer

### La formule légale

> **Nouveau loyer = Loyer actuel × (IRL du trimestre de référence N / IRL du même trimestre N-1)**

### Exemple avec la dernière valeur publiée

Votre bail prévoit une révision avec comme référence le **{{IRL_LATEST_LABEL}}** (le plus récent publié par l'INSEE).

- Loyer actuel : 750 €/mois
- IRL {{IRL_LATEST_LABEL}} : {{IRL_LATEST_VALUE}}
- IRL {{IRL_YEARAGO_LABEL}} : {{IRL_YEARAGO_VALUE}}
- Hausse autorisée : {{IRL_EVOLUTION_PCT}} %
- Nouveau loyer : 750 × (1 + {{IRL_EVOLUTION_PCT}}/100), arrondi au centime le plus proche

### Le trimestre de référence

Le bail doit préciser quel trimestre sert de référence. Si rien n'est mentionné, on prend le **dernier IRL connu à la date anniversaire du bail**.

---

## Les règles à respecter

### La clause de révision est obligatoire dans le bail

Sans clause de révision écrite dans le bail, **vous ne pouvez pas réviser le loyer**. Si cette clause est absente, le loyer reste figé pendant toute la durée du bail.

### La révision est annuelle, jamais rétroactive

Vous pouvez réviser le loyer une fois par an, à la date anniversaire du bail. Si vous oubliez une année, la révision est **définitivement perdue** — vous ne pouvez pas la rattraper rétroactivement.

> Exemple : bail signé le 15 mars 2024. Vous pouviez réviser le 15 mars 2025. Si vous ne l'avez pas fait, vous ne pouvez réviser qu'à partir du 15 mars 2026 — avec l'IRL applicable à cette date uniquement.

### Le délai de notification

Il n'existe pas de délai légal imposé pour notifier la révision. Cependant, la pratique recommande d'informer le locataire par **lettre recommandée ou email avec accusé de réception** au moins 1 mois avant la date d'application.

La révision prend effet à compter du moment où vous la notifiez formellement, pas rétroactivement depuis la date anniversaire (sauf accord des parties).

---

## Zones d'encadrement des loyers : règles spécifiques

Dans les villes soumises à l'encadrement des loyers (Paris, Lyon, Bordeaux, Lille, Montpellier, et d'autres communes en zone tendue), des règles supplémentaires s'appliquent — voir notre [guide complet de l'encadrement des loyers](/blog/encadrement-des-loyers-2026-guide) pour le détail par ville.

### L'encadrement à la relocation

Lorsqu'un locataire part et qu'un nouveau arrive, le loyer ne peut pas librement augmenter. Il est plafonné par un **loyer de référence majoré** fixé par arrêté préfectoral selon :
- Le type de bien (vide ou meublé)
- Le nombre de pièces
- La période de construction
- L'arrondissement / quartier

### La révision IRL en zone encadrée

L'IRL s'applique normalement pour la révision annuelle en cours de bail, même en zone d'encadrement. Mais au renouvellement ou à la relocation, le loyer est ramené au plafond applicable si nécessaire.

---

## Peut-on réviser le loyer au-delà de l'IRL ?

Non, sauf exceptions limitées :

- **Travaux d'amélioration** réalisés par le bailleur entre deux locataires ou en accord avec le locataire en cours de bail : une majoration complémentaire est possible, plafonnée et encadrée
- **Loyer manifestement sous-évalué** : à la relocation ou au [renouvellement triennal](/blog/renouvellement-bail-reconduction-tacite), vous pouvez proposer un loyer aligné sur le marché selon une procédure spécifique (comparaison avec 6 logements de référence)

En dehors de ces cas, toute hausse au-delà de l'IRL est illégale et le locataire peut en demander l'annulation.

---

## La révision s'applique-t-elle aux charges aussi ?

Non. L'IRL ne concerne que le **loyer hors charges**. Les charges locatives (provision sur charges) sont régularisées annuellement sur la base des dépenses réelles, indépendamment de l'IRL.

---

## Comment notifier la révision à votre locataire ?

Il n'existe pas de formulaire obligatoire, mais la notification doit mentionner :

1. La date d'application du nouveau loyer
2. L'ancien montant
3. Le nouveau montant
4. L'IRL utilisé (trimestre, valeur, source INSEE)

**Modèle type :**

> *Monsieur / Madame,*
>
> *Conformément à la clause de révision du bail signé le [date], je vous informe que le loyer mensuel sera révisé à compter du [date] selon l'IRL du {{IRL_LATEST_LABEL}} publié par l'INSEE.*
>
> *Calcul : [ancien loyer] × ({{IRL_LATEST_VALUE}} / {{IRL_YEARAGO_VALUE}}) = [nouveau loyer].*
>
> *Le nouveau loyer mensuel hors charges sera de [montant] €, soit une variation de {{IRL_EVOLUTION_PCT}} %.*

---

## Outils pratiques

- [Révision de loyer IRL en ligne](/revision-loyer-irl) — calculez automatiquement le nouveau loyer selon l'IRL en vigueur
- [Modèle de notification de révision de loyer](/modele-notification-revision-loyer) — lettre type à envoyer à votre locataire

*Gérez vos révisions de loyer automatiquement pour chaque bien de votre parc avec notre [outil de gestion locative](/outil-gestion-locative).*
