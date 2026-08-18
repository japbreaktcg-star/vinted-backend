import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";
import { stripe } from "./lib/stripe.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { adminRoutes } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// CORS : seule l'extension Chrome (et plus tard le dashboard admin) doit pouvoir appeler l'API
await app.register(cors, {
  origin: (origin, cb) => {
    // Les extensions Chrome envoient une origine du type chrome-extension://<id>
    // ADMIN_DASHBOARD_ORIGIN sera défini à l'étape 7
    const allowed = [process.env.ADMIN_DASHBOARD_ORIGIN, process.env.CHROME_EXTENSION_ORIGIN].filter(Boolean);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error("Origin non autorisée"), false);
  },
  credentials: true,
});

// Protection basique contre les requêtes abusives (sera affiné étape 3 pour /auth)
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Conserve le corps brut de chaque requête JSON : indispensable pour que Stripe puisse vérifier
// la signature de ses webhooks (la vérification échoue si le corps a été reformaté au passage)
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
  (_req as any).rawBody = body;
  try {
    const json = (body as Buffer).length ? JSON.parse((body as Buffer).toString("utf8")) : {};
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.get("/api/health", async () => {
  return { status: "ok", time: new Date().toISOString() };
});

await app.register(authRoutes);
await app.register(billingRoutes);
await app.register(webhookRoutes);
await app.register(adminRoutes);

// Sert le dashboard admin (fichiers statiques) sur /admin — pas besoin d'un second hébergement
await app.register(staticFiles, {
  root: path.join(__dirname, "..", "public", "admin"),
  prefix: "/admin/",
});

// Sert la page de réinitialisation de mot de passe sur /reset-password
await app.register(staticFiles, {
  root: path.join(__dirname, "..", "public", "reset-password"),
  prefix: "/reset-password/",
  decorateReply: false, // évite un conflit : le plugin ne peut décorer `reply` qu'une seule fois par appli
});

// Page affichée après un paiement Stripe (succès ou annulation) sur /checkout-result
await app.register(staticFiles, {
  root: path.join(__dirname, "..", "public", "checkout-result"),
  prefix: "/checkout-result/",
  decorateReply: false,
});

// Vérifie que la connexion à la base fonctionne
app.get("/api/health/db", async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { db: "ok" };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ db: "error" });
  }
});

// Diagnostic temporaire : liste les prix Stripe existants sur le compte connecté (clé déjà configurée
// sur Railway), pour identifier le bon STRIPE_PRICE_ID. Aucune donnée sensible exposée. À retirer après usage.
app.get("/api/debug/stripe-prices", async (_req, reply) => {
  try {
    const prices = await stripe.prices.list({ limit: 20, expand: ["data.product"] });
    return reply.send(
      prices.data.map((p) => ({
        priceId: p.id,
        productId: typeof p.product === "string" ? p.product : p.product.id,
        productName: typeof p.product === "string" ? undefined : (p.product as any).name,
        active: p.active,
        amount: p.unit_amount,
        currency: p.currency,
        recurring: p.recurring?.interval,
      }))
    );
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
