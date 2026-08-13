import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../db.js";
import { stripe } from "../lib/stripe.js";

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/stripe", async (req, reply) => {
    const signature = req.headers["stripe-signature"];
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!signature || !rawBody) {
      return reply.status(400).send({ error: "Requête webhook invalide." });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      app.log.warn(`Signature webhook Stripe invalide: ${(err as Error).message}`);
      return reply.status(400).send({ error: "Signature invalide." });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && session.customer) {
            await syncSubscriptionFromStripe(session.customer as string, session.subscription as string);
          }
          break;
        }

        // Couvre : renouvellement, changement de statut, paiement échoué (Stripe met status=past_due), annulation programmée
        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const sub = event.data.object as Stripe.Subscription;
          await syncSubscriptionFromStripe(sub.customer as string, sub.id);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: { status: "canceled" },
          });
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.customer) {
            await prisma.subscription.updateMany({
              where: { stripeCustomerId: invoice.customer as string },
              data: { status: "past_due" },
            });
          }
          break;
        }

        default:
          break; // événements non gérés, ignorés volontairement
      }
    } catch (err) {
      app.log.error(err);
      // On renvoie quand même 200 pour éviter que Stripe ne renvoie indéfiniment un événement qu'on ne saura jamais traiter,
      // mais l'erreur est loguée pour investigation manuelle.
    }

    return reply.send({ received: true });
  });
}

async function syncSubscriptionFromStripe(stripeCustomerId: string, stripeSubscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  const userId = (customer as Stripe.Customer).metadata?.userId;
  if (!userId) return;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  });
}
