# Documentation - Alertes bailleur

Cette documentation résume le système d'alertes email de l'espace bailleur lokt.fr.

## Objectif

Envoyer au propriétaire un email quotidien lorsqu'une action importante est à traiter dans son espace bailleur.

Le système évite les oublis métier :

- loyer en retard ;
- loyer bientôt exigible ;
- quittance à générer ou envoyer ;
- révision annuelle du loyer à préparer ;
- bail bientôt à échéance ;
- bail expiré mais encore actif ;
- état des lieux d'entrée manquant ;
- état des lieux de sortie à préparer ;
- email locataire manquant ;
- email bailleur de notification manquant.

## Fichiers concernés

- Cron principal : `pages/api/cron/landlord-alerts.ts`
- Configuration Vercel Cron pour la génération de quittances : `vercel.json`
- Synchronisation cron-job.org : `scripts/configure-cron-job-org.mjs`
- Table anti-spam : `supabase/migrations/20260520_landlord_alert_sends.sql`
- Table anti-doublon pour les relances de validation : `supabase/migrations/20260531170000_rent_reminder_followup_sends.sql`
- Préférences pilotables par le bailleur : `supabase/migrations/20260531183000_landlord_alert_preferences.sql`
- Envoi email Resend : `lib/mailer/resend.ts`

## Fonctionnement

Le cron `/api/cron/landlord-alerts` analyse les données bailleur :

- `leases`
- `properties`
- `tenants`
- `rent_payments`
- `rent_receipts`
- `inventory_reports`

Il regroupe les alertes par utilisateur, puis envoie un seul email digest par propriétaire.

Un propriétaire ne reçoit qu'un email d'alerte par jour grâce à la table :

```sql
landlord_alert_sends
```

Depuis l'onglet `Alertes` de l'espace bailleur, chaque utilisateur peut suspendre le récapitulatif quotidien ou choisir précisément les alertes à conserver. Les comptes sans préférence enregistrée gardent toutes les alertes actives par défaut.

Le plan gratuit conserve quatre alertes essentielles : loyer en retard, quittance à finaliser, email locataire manquant et email bailleur manquant. Starter et Essentiel débloquent toutes les alertes préventives et métier, notamment les échéances à venir, la révision annuelle du loyer, la fin de bail et les états des lieux.

cron-job.org déclenche également `/api/cron/rent-followups` une fois par jour. Si le propriétaire n'a cliqué sur aucune réponse dans le mail de validation du paiement après 24 heures, il reçoit une relance unique avec les mêmes actions. La table `rent_reminder_followup_sends` bloque les doublons.

## Alertes envoyées

### Retard de paiement

Déclenchée si le loyer de la période courante n'est pas marqué payé et que la date d'échéance est dépassée.

### Loyer bientôt exigible

Déclenchée si le loyer arrive à échéance dans les 3 prochains jours.

### Quittance à finaliser

Déclenchée si le paiement est confirmé mais que la quittance n'a pas encore de PDF ou n'a pas été envoyée.

### Révision annuelle du loyer à préparer

Déclenchée un mois puis deux semaines avant la date anniversaire du bail. Elle demande au bailleur de vérifier la clause de révision, le DPE et l'IRL applicable avant toute démarche. Elle ne présente jamais la hausse comme automatique.

### Bail bientôt à échéance

Déclenchée si la date de fin du bail approche.

Seuils actuels :

- environ 60 jours avant ;
- environ 30 jours avant ;
- environ 7 jours avant.

### Bail expiré encore actif

Déclenchée si la date de fin est dépassée mais que le bail n'est pas clôturé.

### État des lieux d'entrée manquant

Déclenchée si aucun état des lieux d'entrée n'est rattaché au bail.

### État des lieux de sortie à préparer

Déclenchée si le bail arrive à échéance ou est terminé, mais que l'état des lieux de sortie n'est pas finalisé.

Un état des lieux de sortie est considéré finalisé si son statut est :

- `ready`
- `signed`
- `archived`

### Email locataire manquant

Déclenchée si aucun email locataire n'est disponible pour envoyer les quittances.

### Email bailleur manquant

Déclenchée si aucun email de notification bailleur n'est configuré sur le bail.

## Pré-requis environnement

Variables à configurer dans Vercel :

```bash
CRON_SECRET
RESEND_API_KEY
RESEND_FROM
RESEND_REPLY_TO
NEXT_PUBLIC_SITE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
```

`NEXT_PUBLIC_SITE_URL` doit contenir l'URL publique du site, par exemple :

```bash
https://lokt.fr
```

Pour synchroniser cron-job.org depuis le poste local sans exposer la clé dans Git, ajouter également dans `.env.local` :

```bash
CRON_JOB_ORG_API_KEY=...
```

## Répartition des tâches planifiées

Vercel conserve uniquement la génération de quittances :

```json
{
  "path": "/api/cron/receipts-generate",
  "schedule": "0 9 * * *"
}
```

cron-job.org gère les automatisations complémentaires :

- `lokt - alertes bailleur quotidiennes` à `09:30` heure de Paris ;
- `lokt - relance validation loyer J+1` à `09:15` heure de Paris.

La configuration cron-job.org est créée ou mise à jour automatiquement via :

```bash
npm run cron:sync
```

Le script utilise l'API REST cron-job.org. Il transmet `CRON_SECRET` via l'authentification HTTP Basic de chaque tâche. Le secret ne figure donc pas dans les URLs ni dans les logs d'accès. Les endpoints acceptent aussi l'en-tête `Authorization: Bearer ...` envoyé nativement par Vercel Cron et l'en-tête HTTP `x-cron-secret`.

Par sécurité, une synchronisation simple crée ou met à jour les tâches en mode inactif. Après déploiement de l'application, les activer avec :

```bash
npm run cron:sync -- --enable
```

## Migration Supabase

Avant activation en production, appliquer la migration :

```sql
supabase/migrations/20260520_landlord_alert_sends.sql
supabase/migrations/20260531170000_rent_reminder_followup_sends.sql
supabase/migrations/20260531183000_landlord_alert_preferences.sql
```

Cette table sert à éviter qu'un utilisateur reçoive plusieurs emails d'alerte le même jour.

## Tester en local

Démarrer le serveur :

```bash
npm run dev
```

Tester sans envoyer d'email :

```bash
curl -H "x-cron-secret: TON_SECRET" "http://localhost:3000/api/cron/landlord-alerts?dryRun=1&force=1"
```

Tester avec envoi réel :

```bash
curl -H "x-cron-secret: TON_SECRET" "http://localhost:3000/api/cron/landlord-alerts?force=1"
```

## Réponse attendue

Le cron renvoie un JSON avec les utilisateurs traités :

```json
{
  "ok": true,
  "digestDate": "2026-05-20",
  "dryRun": true,
  "results": []
}
```

Chaque résultat peut indiquer :

- `sent: true` : email envoyé ;
- `skipped: "already_sent_today"` : déjà envoyé aujourd'hui ;
- `skipped: "no_alerts"` : aucune alerte ;
- `skipped: "no_owner_email"` : impossible de trouver l'email propriétaire.

## Points métier à retenir

Le cron ne remplace pas les actions dans l'application. Il sert à rappeler au propriétaire qu'il doit traiter quelque chose.

Les alertes critiques sont :

- paiement en retard ;
- bail expiré encore actif ;
- EDL de sortie non finalisé.

Les alertes de confort sont :

- loyer bientôt exigible ;
- email manquant ;
- quittance à finaliser.

## Évolutions possibles

- Ajouter une page `Notifications` dans `Mon compte`.
- Permettre au propriétaire de choisir les alertes activées.
- Ajouter une fréquence hebdomadaire au lieu de quotidienne.
- Envoyer certaines alertes par SMS.
- Ajouter une table `notification_preferences`.
