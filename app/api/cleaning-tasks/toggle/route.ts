import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/cleaning-tasks/toggle  { logementId, date: "2026-08-21" }
// Bascule l'état "fait" d'un ménage pour un logement et un jour donnés.
export async function POST(req: NextRequest) {
  const { logementId, date } = await req.json();
  if (!logementId || !date) {
    return NextResponse.json({ error: 'logementId et date sont requis.' }, { status: 400 });
  }
  const day = new Date(date + 'T00:00:00.000Z');

  const existing = await prisma.tacheMenage.findUnique({
    where: { logementId_date: { logementId, date: day } },
  });

  const updated = await prisma.tacheMenage.upsert({
    where: { logementId_date: { logementId, date: day } },
    update: { fait: !existing?.fait, faitLe: !existing?.fait ? new Date() : null },
    create: { logementId, date: day, fait: true, faitLe: new Date() },
  });

  return NextResponse.json(updated);
}
