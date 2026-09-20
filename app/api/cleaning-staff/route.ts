import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: 'MENAGE' },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(users);
}
