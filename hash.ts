import argon2 from "argon2";
import crypto from "node:crypto";

// Argon2id : recommandé aujourd'hui, résistant aux attaques GPU/ASIC, plus sûr que bcrypt pour de nouveaux projets
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Utilisé pour les tokens de rafraîchissement / réinitialisation : on ne stocke jamais le token brut en base,
// seulement son empreinte (comme un mot de passe), pour qu'une fuite de la base ne permette pas de les réutiliser.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
