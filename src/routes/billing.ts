import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { stripe } from "../lib/stripe.js";
import { requireAuth } from "../lib/authenticate.js";

export async function billingRoutes(app: FastifyInstance) {
  // Crée (ou réutilise) le client Stripe lié au compte, puis renvoie l'URL de paiement à ouvrir
  app.post("/api/billing/create-checkout-session", { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscription: true } });
    if (!user) return reply.status(404).send({ error: "Compte introuvable." });

    let stripeCustomerId = user.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      stripeCustomerId = customer.id;
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, stripeCustomerId, status: "none" },
        update: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || `${process.env.PUBLIC_APP_URL}/checkout-result/`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${process.env.PUBLIC_APP_URL}/checkout-result/?status=cancel`,
      // Permet à Stripe de savoir à quel utilisateur rattacher l'abonnement même avant que le webhook n'arrive
      client_reference_id: user.id,
    });

    return reply.send({ url: session.url });
  });

  // Portail Stripe : l'utilisateur peut y changer sa carte, annuler, voir ses factures — sans qu'on ait à recoder tout ça
  app.post("/api/billing/create-portal-session", { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string;
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.stripeCustomerId) {
      return reply.status(400).send({ error: "Aucun abonnement associé à ce compte." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: process.env.STRIPE_SUCCESS_URL || "https://example.com/account",
    });

    return reply.send({ url: session.url });
  });
}
