import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

// POST /api/cleaning-tasks/toggle  { logementId, date: "2026-08-21" }
// Bascule l'état "fait" d'un ménage pour un logement et un jour donnés.
export async function POST(req: NextRequest) {
  const { logementId, date } = await req.json();
  if (!logementId || !date) {
    return NextResponse.json({ error: 'logementId et date sont requis.' }, { status: 400 });
  }
  const day = new Date(date + 'T00:00:00.000Z');
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  const existing = await prisma.tacheMenage.findUnique({
    where: { logementId_date: { logementId, date: day } },
  });

  const nextDone = !existing?.fait;
  const updated = await prisma.tacheMenage.upsert({
    where: { logementId_date: { logementId, date: day } },
    update: {
      fait: nextDone,
      faitLe: nextDone ? new Date() : null,
      faitParUserId: nextDone ? session?.userId || null : null,
    },
    create: {
      logementId,
      date: day,
      fait: true,
      faitLe: new Date(),
      faitParUserId: session?.userId || null,
    },
  });

  return NextResponse.json(updated);
}
