import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { splitDay, buildCleaningTasks } from '@/lib/cleaning';

// GET /api/dashboard/day?date=2026-08-21
// Renvoie les arrivées, départs et la liste des ménages (avec priorité)
// pour le jour demandé, en excluant les réservations annulées.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  if (!dateParam) {
    return NextResponse.json({ error: 'Paramètre "date" requis (YYYY-MM-DD).' }, { status: 400 });
  }
  const day = new Date(dateParam + 'T00:00:00.000Z');

  // On charge une fenêtre large autour du jour (pour couvrir les fuseaux horaires
  // proprement) puis on filtre précisément côté logique métier.
  const windowStart = new Date(day);
  windowStart.setUTCDate(windowStart.getUTCDate() - 30);
  const windowEnd = new Date(day);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

  const reservations = await prisma.reservation.findMany({
    where: {
      statut: { not: 'ANNULEE' },
      OR: [
        { dateArrivee: { gte: windowStart, lt: windowEnd } },
        { dateDepart: { gte: windowStart, lt: windowEnd } },
      ],
    },
    include: { logement: { include: { zone: true } } },
  });

  const normalized = reservations.map((r) => ({
    ...r,
    logement: { ...r.logement, nom: `${r.logement.zone.nom}${r.logement.batiment ? ' - ' + r.logement.batiment : ''}${r.logement.numero ? ' - App.' + r.logement.numero : ''}` },
  }));

  const { outs, ins } = splitDay(normalized as any, day);
  const tasks = buildCleaningTasks(outs as any, ins as any);
  const previousOuts = normalized.filter((r) => {
    const dateDepart = new Date(r.dateDepart);
    return dateDepart < day && r.statut !== 'ANNULEE';
  });
  const previousTasks = buildCleaningTasks(previousOuts as any, []).map((t) => ({
    ...t,
    urgent: false,
    overdue: true,
  }));

  // Merge avec l'etat stocke en base. Les menages du jour restent visibles
  // meme une fois coches afin de pouvoir annuler une validation faite par erreur.
  const taskRows = await prisma.tacheMenage.findMany({
    where: {
      date: { gte: windowStart, lte: day },
    },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  const rowByKey = new Map(taskRows.map((d) => [`${d.logementId}:${d.date.toISOString().slice(0, 10)}`, d]));
  const tasksWithDone = [...previousTasks, ...tasks]
    .filter((t) => {
      const row = rowByKey.get(`${t.logementId}:${t.date}`);
      return !t.overdue || !row?.fait;
    })
    .map((t) => {
      const row = rowByKey.get(`${t.logementId}:${t.date}`);
      return {
        ...t,
        fait: Boolean(row?.fait),
        faitLe: row?.faitLe?.toISOString() || null,
        assigneeUserId: row?.assigneeUserId || null,
        assigneeName: row?.assignee?.name || row?.assignee?.email || null,
      };
    });

  return NextResponse.json({
    date: dateParam,
    outs: outs.map((r: any) => ({
      id: r.id,
      nomVoyageur: r.nomVoyageur,
      logementNom: r.logement.nom,
      heureCheckout: r.heureCheckout,
    })),
    ins: ins.map((r: any) => ({
      id: r.id,
      nomVoyageur: r.nomVoyageur,
      logementNom: r.logement.nom,
      heureCheckin: r.heureCheckin,
    })),
    tasks: tasksWithDone,
  });
}
