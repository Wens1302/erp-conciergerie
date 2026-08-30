import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/logements/:id — fiche bien complète (sans identifiants de connexion)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const logement = await prisma.logement.findUnique({
    where: { id },
    include: {
      zone: true,
      acces: { select: { plateforme: true, identifiant: true, updatedAt: true } },
    },
  });
  if (!logement) return NextResponse.json({ error: 'Logement introuvable.' }, { status: 404 });
  return NextResponse.json(logement);
}

// PATCH /api/logements/:id — met à jour la fiche bien (infos non sensibles uniquement)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const logement = await prisma.logement.update({
    where: { id },
    data: {
      nomProprietaire: body.nomProprietaire ?? undefined,
      telephoneProprietaire: body.telephoneProprietaire ?? undefined,
      parking: typeof body.parking === 'boolean' ? body.parking : undefined,
      piscine: typeof body.piscine === 'boolean' ? body.piscine : undefined,
      nombreChambres: body.nombreChambres !== undefined ? Number(body.nombreChambres) || null : undefined,
      nombreSallesDeBain:
        body.nombreSallesDeBain !== undefined ? Number(body.nombreSallesDeBain) || null : undefined,
      adresse: body.adresse ?? undefined,
      geolocalisation: body.geolocalisation ?? undefined,
      automatisable: typeof body.automatisable === 'boolean' ? body.automatisable : undefined,
      wifiInfo: body.wifiInfo ?? undefined,
      numConcierge: body.numConcierge ?? undefined,
      detailsBien: body.detailsBien ?? undefined,
    },
    include: { zone: true },
  });

  return NextResponse.json(logement);
}
