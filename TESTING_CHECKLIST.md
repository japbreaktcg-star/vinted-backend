# Checklist de test — à faire dans cet ordre

## 1. Backend seul
- [ ] `npm install` puis `npm run dev` démarre sans erreur
- [ ] `http://localhost:3000/api/health` répond `{"status":"ok"}`
- [ ] `http://localhost:3000/api/health/db` répond `{"db":"ok"}` (sinon vérifie `DATABASE_URL`)

## 2. Compte / connexion
- [ ] Créer un compte via l'extension (écran "Créer un compte")
- [ ] Se déconnecter puis se reconnecter avec le même email/mot de passe
- [ ] Se tromper de mot de passe → message d'erreur clair, pas de connexion
- [ ] "Mot de passe oublié" → vérifier dans les logs du serveur qu'un token est bien généré (l'envoi d'email n'est pas encore branché, voir note plus bas)

## 3. Abonnement Stripe (en mode TEST Stripe, pas live)
- [ ] Sans abonnement, l'extension affiche bien l'écran "Abonnement requis"
- [ ] Cliquer "S'abonner" ouvre bien la page de paiement Stripe
- [ ] Payer avec une carte de test Stripe (4242 4242 4242 4242, n'importe quelle date future, n'importe quel CVC)
- [ ] Après paiement, rouvrir l'extension → l'accès aux fonctionnalités (CSV/photos) doit se débloquer (ça peut prendre quelques secondes, le temps que le webhook Stripe arrive)
- [ ] Dans Stripe → annuler l'abonnement manuellement → dans l'extension, forcer une vérification (se déconnecter/reconnecter) → l'accès doit se rebloquer

## 4. Fonctionnalités existantes (ne doivent pas avoir changé)
- [ ] Générer des annonces à partir d'un CSV + dossier photo fonctionne toujours comme avant
- [ ] Le pré-remplissage sur Vinted fonctionne toujours

## 5. Dashboard admin
- [ ] `npm run make-admin -- ton-email@exemple.com` puis se connecter sur `/admin/`
- [ ] Les statistiques s'affichent (nombre d'utilisateurs, abonnements actifs, etc.)
- [ ] Rechercher un email fonctionne
- [ ] Désactiver un compte de test → se reconnecter avec ce compte doit échouer avec "compte désactivé"
- [ ] Réactiver le même compte → la connexion refonctionne

## Point important non automatisé
L'envoi d'email (mot de passe oublié) n'est pas encore branché à un vrai service d'envoi — le token est généré et loggé côté serveur mais pas envoyé. Dis-moi si tu veux qu'on ajoute un service d'email (ex: Resend, gratuit jusqu'à un certain volume) pour que ce soit vraiment fonctionnel en production.

## Si quelque chose casse
Dis-moi précisément :
1. À quelle étape ça bloque (numéro ci-dessus)
2. Le message d'erreur exact (dans le popup de l'extension, dans la console du navigateur, ou dans les logs Railway)
