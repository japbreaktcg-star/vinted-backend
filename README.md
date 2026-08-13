# Backend — Vinted Extension (abonnement)

## Stack
Node.js + TypeScript + Fastify + PostgreSQL (Prisma) + Stripe.
Choisi pour rester simple à maintenir seul et peu coûteux à faire tourner (Fastify est léger, Prisma évite d'écrire du SQL à la main pour les migrations).

## Installation en local

```bash
npm install
cp .env.example .env   # puis remplis les valeurs
npm run prisma:generate
npm run prisma:migrate:dev --name init
npm run dev
```

Vérifie que ça tourne : http://localhost:3000/api/health

## Déploiement sur Railway

1. Crée un compte sur railway.app, connecte ton repo GitHub.
2. "New Project" → "Deploy from GitHub repo" → sélectionne ce dossier backend.
3. Ajoute un plugin **PostgreSQL** dans le même projet Railway → il injecte automatiquement `DATABASE_URL`.
4. Dans l'onglet "Variables" du service backend, ajoute toutes les variables listées dans `.env.example` (sauf `DATABASE_URL`, déjà injectée).
5. Dans "Settings" → "Deploy" : commande de build `npm run build && npm run prisma:migrate:deploy`, commande de start `npm start`.
6. Railway te donne une URL publique type `https://ton-projet.up.railway.app` — c'est l'URL à utiliser dans l'extension.

## Migrations de base de données

- En dev : `npm run prisma:migrate:dev` (crée + applique une migration).
- En prod : `npm run prisma:migrate:deploy` (applique les migrations existantes sans en créer de nouvelles) — c'est ce que Railway exécute automatiquement au déploiement si configuré à l'étape 5 ci-dessus.

## Configurer l'envoi d'email (mot de passe oublié)

1. Crée un compte gratuit sur resend.com (pas de carte bancaire nécessaire pour le plan gratuit).
2. "API Keys" → crée une clé → copie-la dans `RESEND_API_KEY`.
3. Pour démarrer sans configurer de domaine, laisse `RESEND_FROM_EMAIL="onboarding@resend.dev"` (fonctionne tout de suite, mais l'email arrivera parfois en spam). Plus tard, tu pourras vérifier ton propre domaine dans Resend pour un envoi plus fiable.
4. Renseigne `PUBLIC_APP_URL` avec l'URL Railway de ton backend — c'est ce qui permet de construire le lien cliquable dans l'email.

## Configurer Stripe (étape 4)

1. Crée un compte sur stripe.com (mode test au début, pour ne pas encaisser de vrais paiements pendant les essais).
2. "Produits" → crée un produit (ex: "Abonnement extension Vinted") avec un prix récurrent mensuel → copie l'ID `price_...` dans `STRIPE_PRICE_ID`.
3. "Développeurs" → "Clés API" → copie la clé secrète dans `STRIPE_SECRET_KEY`.
4. "Développeurs" → "Webhooks" → "Ajouter un endpoint" → URL : `https://ton-backend.up.railway.app/api/webhooks/stripe` → sélectionne les événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → copie le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
5. Une fois que tout fonctionne en mode test, bascule en mode "Live" dans Stripe et remets à jour les 3 clés avec les valeurs live.

## Dashboard admin (étape 7)

Accessible à `https://ton-backend.up.railway.app/admin/` — pas besoin de l'héberger ailleurs, il est servi directement par ce même backend (plus simple et gratuit, un seul service à payer/maintenir).

Pour te donner les droits admin une fois ton compte créé (via l'extension ou `/api/auth/register`) :

```bash
npm run make-admin -- ton-email@exemple.com
```

Connecte-toi ensuite sur `/admin/` avec cet email/mot de passe. Tu peux voir les stats globales, chercher un utilisateur par email, le désactiver/réactiver, ou le supprimer.

## Statut de ce projet (avancement des étapes)

- [x] Étape 1 — Analyse de l'extension existante
- [x] Étape 2 — Backend + base de données (squelette Fastify + schéma Prisma users/subscriptions/refresh_tokens)
- [x] Étape 3 — Inscription / connexion (register, login, refresh, logout, /me, reset de mot de passe)
- [x] Étape 4 — Intégration Stripe (checkout, portail de gestion, webhooks pour synchroniser le statut automatiquement)
- [x] Étape 5 — Vérification de l'abonnement (middleware `requireActiveSubscription`, prêt à protéger toute future route premium)
- [x] Étape 6 — Intégration auth dans l'extension Chrome (écran de connexion/inscription, cache du statut d'abonnement 1h, bouton d'abonnement Stripe)
- [x] Étape 7 — Dashboard administrateur (servi sur `/admin`, stats + gestion des comptes)
- [x] Étape 8 — Checklist de test manuel fournie (`TESTING_CHECKLIST.md`) — à toi de jouer !
- [x] Étape 5 — Vérification de l'abonnement (middleware `requireActiveSubscription`, prêt à protéger toute future route premium)
- [x] Étape 6 — Intégration auth dans l'extension Chrome (écran de connexion/inscription, cache du statut d'abonnement 1h, bouton d'abonnement Stripe)
- [ ] Étape 7 — Dashboard administrateur
- [ ] Étape 8 — Tests de l'ensemble
