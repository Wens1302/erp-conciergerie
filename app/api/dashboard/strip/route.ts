import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { splitDay, buildCleaningTasks } from '@/lib/cleaning';

// GET /api/dashboard/strip?center=2026-08-21&days=12
// Renvoie, pour chaque jour de la fenêtre, le nombre de départs/arrivées/ménages urgents —
// utilisé pour les petits points de couleur sous la frise de dates.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const centerParam = searchParams.get('center');
  const days = Number(searchParams.get('days') || 12);
  if (!centerParam) {
    return NextResponse.json({ error: 'Paramètre "center" requis.' }, { status: 400 });
  }

  const center = new Date(centerParam + 'T00:00:00.000Z');
  const start = new Date(center);
  start.setUTCDate(start.getUTCDate() - Math.floor(days / 2));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days + 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      statut: { not: 'ANNULEE' },
      OR: [
        { dateArrivee: { gte: start, lt: end } },
        { dateDepart: { gte: start, lt: end } },
      ],
    },
    include: { logement: true },
  });

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const { outs, ins } = splitDay(reservations as any, d);
    const tasks = buildCleaningTasks(outs as any, ins as any);
    result.push({
      date: d.toISOString().slice(0, 10),
      outs: outs.length,
      ins: ins.length,
      urgent: tasks.filter((t) => t.urgent).length,
    });
  }

  return NextResponse.json(result);
}
