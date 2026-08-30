import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveLogement } from '@/lib/logements';
import { parseReservationPayload } from '@/lib/reservations';

// GET /api/reservations?statut=VALIDEE&search=malabata
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statut = searchParams.get('statut');
  const search = searchParams.get('search');

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(statut && statut !== 'all' ? { statut: statut as any } : {}),
      ...(search
        ? {
            OR: [
              { nomVoyageur: { contains: search, mode: 'insensitive' } },
              { logement: { nom: { contains: search, mode: 'insensitive' } } },
              { logement: { nomProprietaire: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { logement: { include: { zone: true } } },
    orderBy: { dateArrivee: 'asc' },
  });

  return NextResponse.json(reservations);
}

// POST /api/reservations — création
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { logementFields, reservationFields } = parseReservationPayload(body);

  if (!reservationFields.dateArrivee || !reservationFields.dateDepart) {
    return NextResponse.json(
      { error: "La date d'arrivée et la date de départ sont obligatoires." },
      { status: 400 }
    );
  }
  if (!reservationFields.nomVoyageur) {
    return NextResponse.json({ error: 'Le nom du voyageur est obligatoire.' }, { status: 400 });
  }

  const logement = await resolveLogement(logementFields);

  const reservation = await prisma.reservation.create({
    data: {
      ...reservationFields,
      logementId: logement.id,
    } as any,
    include: { logement: { include: { zone: true } } },
  });

  return NextResponse.json(reservation, { status: 201 });
}
