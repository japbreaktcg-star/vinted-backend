import Stripe from "stripe";

// Clé factice si Stripe n'est pas encore configuré : le serveur démarre, seules les routes de paiement échoueront.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured", {
  apiVersion: "2024-06-20",
});
