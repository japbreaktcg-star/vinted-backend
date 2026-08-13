import "dotenv/config";
import { prisma } from "../src/db.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage : npm run make-admin -- ton-email@exemple.com");
  process.exit(1);
}

const user = await prisma.user.update({ where: { email }, data: { isAdmin: true } }).catch(() => null);

if (!user) {
  console.error(`Aucun compte trouvé avec l'email ${email}. Crée d'abord un compte via l'extension ou /api/auth/register.`);
  process.exit(1);
}

console.log(`✅ ${email} est maintenant administrateur.`);
process.exit(0);
