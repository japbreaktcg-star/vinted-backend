import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "./authenticate.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// À chaîner après requireAuth sur toute route "premium" du backend.
// Vérifie en base (donc impossible à contourner depuis le code de l'extension) que l'abonnement est actif.
export async function requireActiveSubscription(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return; // requireAuth a déjà coupé la requête (non connecté)

  const userId = (req as any).userId as string;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
    return reply.status(402).send({
      error: "Abonnement requis.",
      subscriptionStatus: subscription?.status ?? "none",
    });
  }
}
