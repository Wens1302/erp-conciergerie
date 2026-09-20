import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/cleaning-tasks/assign  { logementId, date: "2026-08-21", assigneeUserId }
export async function POST(req: NextRequest) {
  const { logementId, date, assigneeUserId } = await req.json();
  if (!logementId || !date) {
    return NextResponse.json({ error: 'logementId et date sont requis.' }, { status: 400 });
  }

  if (assigneeUserId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeUserId, role: 'MENAGE' },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: 'Dame de menage introuvable.' }, { status: 404 });
    }
  }

  const day = new Date(date + 'T00:00:00.000Z');
  const updated = await prisma.tacheMenage.upsert({
    where: { logementId_date: { logementId, date: day } },
    update: { assigneeUserId: assigneeUserId || null },
    create: { logementId, date: day, assigneeUserId: assigneeUserId || null },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
