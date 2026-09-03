/**
 * Cree le compte administrateur initial.
 *
 * Usage PowerShell :
 *   $env:ADMIN_EMAIL="toi@example.com"
 *   $env:ADMIN_PASSWORD="un-mot-de-passe-solide"
 *   npm run create:admin
 */

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} est obligatoire.`);
  }
  return value;
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL doit etre une adresse email valide.');
  }
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD doit contenir au moins 8 caracteres.');
  }
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');

  validateEmail(email);
  validatePassword(password);

  const otherAdmin = await prisma.user.findFirst({
    where: {
      role: Role.ADMIN,
      email: { not: email },
    },
    select: { email: true },
  });

  if (otherAdmin) {
    throw new Error(
      `Un autre compte ADMIN existe deja (${otherAdmin.email}). ` +
        'Suppression ou changement de role requis avant de creer celui-ci.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN,
      password: passwordHash,
      name: 'Administrateur',
    },
    create: {
      email,
      name: 'Administrateur',
      role: Role.ADMIN,
      password: passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`Compte admin pret : ${admin.email} (${admin.role})`);
}

main()
  .catch((error) => {
    console.error('Erreur create:admin:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
