# Stripe - abonnements lokt.fr

## État du raccordement côté code

Le site est déjà câblé pour Stripe :

- `/tarifs` et `/mon-compte/abonnement` appellent `/api/billing/create-checkout-session`.
- `/api/billing/stripe-webhook` synchronise l'abonnement dans Supabase.
- `/api/billing/create-portal-session` ouvre le portail Stripe pour gérer l'abonnement.
- Les plans internes sont définis dans `lib/billingPlans.ts`.

Il reste donc surtout à créer les produits/prix dans Stripe, ajouter les variables dans Vercel, activer le portail client et brancher le webhook.

## Produits et prix à créer dans Stripe

Créer des prix récurrents dans Stripe, puis reporter les identifiants `price_...` dans Vercel.

| Offre | Mensuel | Annuel | Plan interne |
| --- | ---: | ---: | --- |
| Starter | 4,90 EUR / mois | 49 EUR / an | `landlord_5` |
| Essentiel | 9,90 EUR / mois | 99 EUR / an | `landlord_15` |
| Pro / agence | Sur devis | Sur devis | `landlord_unlimited` |

Créer deux prix récurrents par offre payante :

- Starter mensuel : 4,90 EUR, récurrence mensuelle.
- Starter annuel : 49 EUR, récurrence annuelle.
- Essentiel mensuel : 9,90 EUR, récurrence mensuelle.
- Essentiel annuel : 99 EUR, récurrence annuelle.

Le plan Pro / agence reste volontairement hors checkout automatique : il renvoie vers un contact commercial.

## Variables Vercel

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_ESSENTIEL_MONTHLY=price_...
STRIPE_PRICE_ESSENTIEL_YEARLY=price_...
NEXT_PUBLIC_SITE_URL=https://lokt.fr
```

Les anciennes variables `STRIPE_PRICE_LANDLORD_5` et `STRIPE_PRICE_LANDLORD_15` restent tolérées en secours, mais la production doit utiliser les variables mensuel/annuel.

À configurer dans Vercel :

- Production : clés Stripe live, prix live, `NEXT_PUBLIC_SITE_URL=https://lokt.fr`.
- Preview : idéalement clés Stripe test, prix test, URL de preview ou domaine de staging.
- Development local : mêmes variables dans `.env.local`, mais avec les clés test.

Ne jamais mettre les clés `sk_...` ou `whsec_...` côté client. Les seules variables exposées au navigateur doivent commencer par `NEXT_PUBLIC_`.

## Webhook Stripe

Configurer l'endpoint :

```txt
https://lokt.fr/api/billing/stripe-webhook
```

Événements minimum :

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Le webhook écrit dans `subscriptions` : plan, statut, client Stripe, abonnement Stripe, prix, fin de période et annulation à fin de période.

Le secret `whsec_...` est généré par Stripe au moment de la création de l'endpoint webhook. C'est ce secret précis qu'il faut mettre dans `STRIPE_WEBHOOK_SECRET` sur Vercel.

## Portail client Stripe

Activer le Customer Portal dans Stripe Billing. Le bouton "Gérer mon abonnement" dans `/mon-compte/abonnement` ouvre :

```txt
/api/billing/create-portal-session
```

Recommandation : autoriser la mise à jour du moyen de paiement, la consultation des factures et l'annulation à la fin de la période payée.

Pour la stratégie lokt.fr, privilégier l'annulation à fin de période plutôt qu'une coupure immédiate : l'utilisateur conserve l'accès payé jusqu'à la fin du mois ou de l'année déjà réglé.

## Supabase

Appliquer la migration :

```txt
supabase/migrations/20260521_subscriptions_stripe_fields.sql
```

Sans cette migration, le webhook ne pourra pas stocker les champs Stripe nécessaires au portail client.

## Test de bout en bout

1. Mettre les variables Stripe test dans `.env.local`.
2. Créer un compte utilisateur sur le site.
3. Aller sur `/tarifs` ou `/mon-compte/abonnement`.
4. Cliquer sur "Souscrire" sur Starter ou Essentiel.
5. Payer avec une carte test Stripe.
6. Vérifier le retour vers `/mon-compte/abonnement?checkout=success`.
7. Vérifier dans Supabase que `subscriptions` contient le plan, le `stripe_customer_id`, le `stripe_subscription_id`, le `stripe_price_id` et le statut.
8. Cliquer sur "Gérer mon abonnement" pour tester le portail client.
9. Tester l'annulation à fin de période depuis le portail.
10. Vérifier que le webhook met à jour `cancel_at_period_end` et `ends_at`.

Carte test Stripe classique :

```txt
4242 4242 4242 4242
```

Date future, CVC au choix, code postal au choix.
