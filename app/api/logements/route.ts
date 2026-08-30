import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/logements — liste des biens avec leur fiche (sans les identifiants de connexion,
// qui passent par /api/logements/:id/acces, séparément, pour ne jamais les exposer par accident
// dans une liste).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  const logements = await prisma.logement.findMany({
    where: search
      ? {
          OR: [
            { nom: { contains: search, mode: 'insensitive' } },
            { nomProprietaire: { contains: search, mode: 'insensitive' } },
            { adresse: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      zone: true,
      acces: { select: { plateforme: true, identifiant: true, updatedAt: true } }, // pas les mots de passe
    },
    orderBy: { nom: 'asc' },
  });

  return NextResponse.json(logements);
}
