import { PrismaClient } from "@prisma/client";

function getSanitizedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  // Remove eventual prefixo acidental "DATABASE_URL=" e aspas extras ao colar na Vercel
  let url = raw
    .trim()
    .replace(/^DATABASE_URL\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();

  // Em ambiente Serverless (Vercel) + Supabase Pooler, limita conexões por instância para evitar MaxClientsInSessionMode
  if (url.startsWith("postgres") && !url.includes("connection_limit=")) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}connection_limit=2&pool_timeout=30`;
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const sanitizedUrl = getSanitizedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(sanitizedUrl ? { datasources: { db: { url: sanitizedUrl } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

globalForPrisma.prisma = prisma;
