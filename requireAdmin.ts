import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "./authenticate.js";

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;

  const userId = (req as any).userId as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.isAdmin) {
    return reply.status(403).send({ error: "Accès réservé à l'administrateur." });
  }
}
