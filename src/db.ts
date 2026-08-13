import { PrismaClient } from "@prisma/client";

// Un seul client Prisma réutilisé dans toute l'appli (évite d'épuiser les connexions Postgres)
export const prisma = new PrismaClient();
