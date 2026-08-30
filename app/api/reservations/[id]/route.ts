import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveLogement } from '@/lib/logements';
import { parseReservationPayload } from '@/lib/reservations';

type Params = { params: Promise<{ id: string }> };

// GET /api/reservations/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { logement: { include: { zone: true } } },
  });
  if (!reservation) {
    return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
  }
  return NextResponse.json(reservation);
}

// PUT /api/reservations/:id — mise à jour complète
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
  }

  const body = await req.json();
  const { logementFields, reservationFields } = parseReservationPayload(body);

  if (!reservationFields.dateArrivee || !reservationFields.dateDepart) {
    return NextResponse.json(
      { error: "La date d'arrivée et la date de départ sont obligatoires." },
      { status: 400 }
    );
  }

  // Si les champs de logement ont changé, on résout (ou recrée) le bon logement.
  const logement = await resolveLogement(logementFields);

  const reservation = await prisma.reservation.update({
    where: { id },
    data: {
      ...reservationFields,
      logementId: logement.id,
    } as any,
    include: { logement: { include: { zone: true } } },
  });

  return NextResponse.json(reservation);
}

// DELETE /api/reservations/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
  }
  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
