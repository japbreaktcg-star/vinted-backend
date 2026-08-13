import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "./jwt.js";

// À utiliser en preHandler sur toute route qui doit être protégée.
// Ajoute req.userId si le token est valide, sinon coupe la requête avec 401.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Non authentifié." });
  }
  try {
    const payload = verifyAccessToken(auth.slice(7));
    (req as any).userId = payload.sub;
  } catch {
    return reply.status(401).send({ error: "Session invalide." });
  }
}
