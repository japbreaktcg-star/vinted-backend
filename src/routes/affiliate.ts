import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { stripe } from "../lib/stripe.js";
import { requireAdmin } from "../lib/requireAdmin.js";

const createSchema = z.object({
  code: z.string().trim().min(3).max(30),
  influencerName: z.string().trim().min(1),
  influencerEmail: z.string().email().optional().or(z.literal("")),
  discountPercent: z.number().int().min(1).max(100),
  commissionPercent: z.number().int().min(0).max(100),
});

export async function affiliateRoutes(app: FastifyInstance) {
  // Crée un code affilié : le code de réduction est créé côté Stripe (coupon + promotion code),
  // la réduction ne s'applique qu'au premier paiement (duration "once") pour ne pas grignoter
  // les renouvellements indéfiniment. Ajustable directement depuis le dashboard Stripe si besoin.
  app.post("/api/admin/affiliate-codes", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Champs invalides." });

    const { code, influencerName, influencerEmail, discountPercent, commissionPercent } = parsed.data;
    const codeUpper = code.toUpperCase();

    const existing = await prisma.affiliateCode.findUnique({ where: { code: codeUpper } });
    if (existing) return reply.status(409).send({ error: "Ce code existe déjà." });

    let stripePromotionCodeId: string;
    try {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "once",
        name: `Affilié ${influencerName}`,
      });
      const promotionCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: codeUpper,
      });
      stripePromotionCodeId = promotionCode.id;
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Erreur Stripe lors de la création du code." });
    }

    const affiliateCode = await prisma.affiliateCode.create({
      data: {
        code: codeUpper,
        influencerName,
        influencerEmail: influencerEmail || null,
        discountPercent,
        commissionPercent,
        stripePromotionCodeId,
      },
    });

    return reply.send(affiliateCode);
  });

  // Liste les codes avec le nombre de personnes ramenées et combien ont un abonnement actif
  // (la commission exacte en euros est à calculer toi-même : nb actifs x % commission x prix de l'abonnement).
  app.get("/api/admin/affiliate-codes", { preHandler: requireAdmin }, async (_req, reply) => {
    const codes = await prisma.affiliateCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: { include: { subscription: true } },
      },
    });

    return reply.send(
      codes.map((c) => {
        const referred = c.users.length;
        const activeReferred = c.users.filter((u) =>
          ["active", "trialing"].includes(u.subscription?.status ?? "")
        ).length;
        return {
          id: c.id,
          code: c.code,
          influencerName: c.influencerName,
          influencerEmail: c.influencerEmail,
          discountPercent: c.discountPercent,
          commissionPercent: c.commissionPercent,
          isActive: c.isActive,
          createdAt: c.createdAt,
          referredUsers: referred,
          activeReferredUsers: activeReferred,
        };
      })
    );
  });

  // Désactive un code (le désactive aussi côté Stripe) — on ne le supprime jamais pour garder
  // l'historique de qui a été ramené par cet influenceur.
  app.post("/api/admin/affiliate-codes/:id/deactivate", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const code = await prisma.affiliateCode.findUnique({ where: { id } });
    if (!code) return reply.status(404).send({ error: "Code introuvable." });

    if (code.stripePromotionCodeId) {
      try {
        await stripe.promotionCodes.update(code.stripePromotionCodeId, { active: false });
      } catch (err) {
        app.log.error(err);
      }
    }
    await prisma.affiliateCode.update({ where: { id }, data: { isActive: false } });
    return reply.send({ ok: true });
  });
}
