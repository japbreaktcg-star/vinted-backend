import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword, hashToken, generateRandomToken } from "../lib/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from "../lib/jwt.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères minimum"),
});

const REFRESH_TOKEN_DAYS = 30;

export async function authRoutes(app: FastifyInstance) {
  // Limite spécifique plus stricte sur l'auth pour éviter le brute-force du mot de passe
  const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/api/auth/register", authRateLimit, async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Email ou mot de passe invalide." });

    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ error: "Un compte existe déjà avec cet email." });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    return issueSession(reply, user.id);
  });

  app.post("/api/auth/login", authRateLimit, async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Email ou mot de passe invalide." });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Message volontairement identique en cas d'email inconnu ou mot de passe faux, pour ne pas révéler quels emails existent
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return reply.status(401).send({ error: "Email ou mot de passe incorrect." });
    }
    if (!user.isActive) {
      return reply.status(403).send({ error: "Ce compte a été désactivé." });
    }

    return issueSession(reply, user.id);
  });

  app.post("/api/auth/refresh", async (req, reply) => {
    const token = (req.body as any)?.refreshToken;
    if (!token) return reply.status(400).send({ error: "Token manquant." });

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return reply.status(401).send({ error: "Session invalide, reconnecte-toi." });
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) return reply.status(401).send({ error: "Session expirée, reconnecte-toi." });

    // Rotation : on invalide l'ancien refresh token et on en émet un nouveau à chaque utilisation
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    return issueSession(reply, payload.sub);
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = (req.body as any)?.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ authenticated: false });

    let payload: { sub: string };
    try {
      payload = verifyAccessToken(auth.slice(7));
    } catch {
      return reply.status(401).send({ authenticated: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { subscription: true },
    });
    if (!user || !user.isActive) return reply.status(401).send({ authenticated: false });

    // Tant que l'étape 4 (Stripe) n'est pas branchée, subscriptionActive reste toujours false
    const status = user.subscription?.status ?? "none";
    return reply.send({
      authenticated: true,
      email: user.email,
      subscriptionActive: status === "active" || status === "trialing",
      subscriptionStatus: status,
      subscriptionEnd: user.subscription?.currentPeriodEnd ?? null,
    });
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, reply) => {
    const email = (req.body as any)?.email;
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

    // Réponse identique que le compte existe ou non, pour ne pas révéler quels emails sont inscrits
    if (user) {
      const rawToken = generateRandomToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashToken(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
        },
      });
      // Envoi réel de l'email via Resend, avec un lien vers la page de réinitialisation servie par ce backend
      const resetLink = `${process.env.PUBLIC_APP_URL}/reset-password/?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetLink);
      app.log.info(`Email de réinitialisation envoyé à ${email}`);
    }
    return reply.send({ ok: true, message: "Si ce compte existe, un email a été envoyé." });
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req, reply) => {
    const schema = z.object({ token: z.string(), newPassword: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Requête invalide." });

    const tokenHash = hashToken(parsed.data.token);
    const user = await prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!user) return reply.status(400).send({ error: "Lien invalide ou expiré." });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
    return reply.send({ ok: true });
  });
}

// Émet un access token + refresh token, et enregistre le refresh token en base pour pouvoir le révoquer plus tard
async function issueSession(reply: any, userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return reply.send({ accessToken, refreshToken });
}
