# Emails d'authentification lokt.fr

Ces templates sont synchronises vers Supabase Auth avec :

```bash
npm run auth:sync-emails -- --dry-run
npm run auth:sync-emails -- --apply
```

Variables requises dans `.env.local` :

```bash
SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=
```

`SUPABASE_ACCESS_TOKEN` est un token personnel cree dans les parametres du compte Supabase.
`SUPABASE_PROJECT_REF` est optionnel si `NEXT_PUBLIC_SUPABASE_URL` est deja renseigne.

Pour appliquer egalement le SMTP personnalise :

```bash
npm run auth:sync-emails -- --apply --include-smtp
```

La configuration Resend déjà présente dans `.env.local` est réutilisée par défaut :

```bash
RESEND_FROM=lokt.fr <contact@lokt.fr>
RESEND_API_KEY=
```

Les variables `SUPABASE_AUTH_SMTP_*` peuvent être ajoutées pour remplacer ces valeurs. Pour utiliser `no-reply@auth.lokt.fr`, vérifier auparavant ce sous-domaine dans Resend.

Le script applique automatiquement `Site URL` à `https://lokt.fr`.

Vérifier ensuite dans Supabase la liste des URL de redirection autorisées :

- espace locataire : `https://lokt.fr/espace-locataire`
- test local : `http://localhost:3000/**`

Les fragments `_base-start.html` et `_base-end.html` sont assembles automatiquement autour de chaque template.
