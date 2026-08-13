import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// Access token : courte durée de vie, envoyé à chaque requête de l'extension
export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId, type: "access" }, ACCESS_SECRET, { expiresIn: "15m" });
}

// Refresh token : longue durée de vie, sert uniquement à obtenir un nouvel access token sans se reconnecter
export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string };
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
