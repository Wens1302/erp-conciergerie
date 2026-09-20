import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCleaningTasks, splitDay } from '@/lib/cleaning';

function parseDay(value: string | null, fallback: Date) {
  return value ? new Date(value + 'T00:00:00.000Z') : fallback;
}

function formatLogement(logement: any) {
  return `${logement.zone.nom}${logement.batiment ? ' - ' + logement.batiment : ''}${logement.numero ? ' - App.' + logement.numero : ''}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const monthParam = searchParams.get('month') || now.toISOString().slice(0, 7);
  const [year, month] = monthParam.split('-').map(Number);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametre "month" invalide (YYYY-MM).' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const start = parseDay(searchParams.get('start'), monthStart);
  const endExclusive = parseDay(searchParams.get('end'), monthEnd);

  const reservations = await prisma.reservation.findMany({
    where: {
      statut: { not: 'ANNULEE' },
      OR: [
        { dateArrivee: { gte: start, lt: endExclusive } },
        { dateDepart: { gte: start, lt: endExclusive } },
      ],
    },
    include: { logement: { include: { zone: true } } },
  });

  const normalized = reservations.map((r) => ({
    ...r,
    logement: { ...r.logement, nom: formatLogement(r.logement) },
  }));

  const tasks = [];
  for (let d = new Date(start); d < endExclusive; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = new Date(d);
    const { outs, ins } = splitDay(normalized as any, day);
    tasks.push(...buildCleaningTasks(outs as any, ins as any));
  }

  const taskRows = await prisma.tacheMenage.findMany({
    where: { date: { gte: start, lt: endExclusive } },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      faitPar: { select: { id: true, name: true, email: true } },
    },
  });
  const rowByKey = new Map(taskRows.map((row) => [`${row.logementId}:${row.date.toISOString().slice(0, 10)}`, row]));

  const items = tasks.map((task) => {
    const row = rowByKey.get(`${task.logementId}:${task.date}`);
    return {
      ...task,
      fait: Boolean(row?.fait),
      faitLe: row?.faitLe?.toISOString() || null,
      assigneeUserId: row?.assigneeUserId || null,
      assigneeName: row?.assigneeName || row?.assignee?.name || row?.assignee?.email || null,
      faitParName: row?.faitPar?.name || row?.faitPar?.email || null,
    };
  });

  const staff = await prisma.user.findMany({
    where: { role: 'MENAGE' },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true },
  });

  const staffById = new Map(staff.map((user) => [user.id, user]));
  const freeAssigneeNames = Array.from(
    new Set(items.filter((item) => !item.assigneeUserId && item.assigneeName).map((item) => item.assigneeName))
  );
  const groups = [
    ...staff.map((user) => ({
      assigneeUserId: user.id,
      assigneeName: user.name || user.email,
      tasks: items.filter((item) => item.assigneeUserId === user.id),
    })),
    ...freeAssigneeNames.map((name) => ({
      assigneeUserId: null,
      assigneeName: name || 'Non assigne',
      tasks: items.filter((item) => !item.assigneeUserId && item.assigneeName === name),
    })),
    {
      assigneeUserId: null,
      assigneeName: 'Non assigne',
      tasks: items.filter((item) => (!item.assigneeUserId || !staffById.has(item.assigneeUserId)) && !item.assigneeName),
    },
  ].map((group) => ({
    ...group,
    total: group.tasks.length,
    done: group.tasks.filter((task) => task.fait).length,
    urgent: group.tasks.filter((task) => task.urgent).length,
  }));

  return NextResponse.json({
    month: monthParam,
    start: start.toISOString().slice(0, 10),
    end: endExclusive.toISOString().slice(0, 10),
    staff,
    total: items.length,
    done: items.filter((item) => item.fait).length,
    groups,
  });
}
