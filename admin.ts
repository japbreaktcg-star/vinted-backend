import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAdmin } from "../lib/requireAdmin.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/stats", { preHandler: requireAdmin }, async (_req, reply) => {
    const [totalUsers, activeUsers, active, canceled, pastDue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
      prisma.subscription.count({ where: { status: "canceled" } }),
      prisma.subscription.count({ where: { status: "past_due" } }),
    ]);
    return reply.send({ totalUsers, activeUsers, activeSubscriptions: active, canceledSubscriptions: canceled, pastDueSubscriptions: pastDue });
  });

  app.get("/api/admin/users", { preHandler: requireAdmin }, async (req, reply) => {
    const search = (req.query as any)?.search as string | undefined;
    const users = await prisma.user.findMany({
      where: search ? { email: { contains: search, mode: "insensitive" } } : undefined,
      include: { subscription: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        isActive: u.isActive,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        subscriptionStatus: u.subscription?.status ?? "none",
        subscriptionEnd: u.subscription?.currentPeriodEnd ?? null,
      }))
    );
  });

  app.post("/api/admin/users/:id/deactivate", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return reply.send({ ok: true });
  });

  app.post("/api/admin/users/:id/reactivate", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    return reply.send({ ok: true });
  });

  app.delete("/api/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.delete({ where: { id } }); // cascade supprime aussi subscription + refresh_tokens
    return reply.send({ ok: true });
  });
}
