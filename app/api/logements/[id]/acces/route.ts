import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptOrNull, decryptOrNull } from '@/lib/crypto';

type Params = { params: Promise<{ id: string }> };

// GET /api/logements/:id/acces
// ⚠️ Renvoie les mots de passe en clair (déchiffrés) — cette route doit être
// réservée au rôle ADMIN une fois l'authentification branchée. Ne pas exposer
// publiquement tant que ce n'est pas fait.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const acces = await prisma.accesCompte.findMany({ where: { logementId: id } });

  const result = acces.map((a) => ({
    plateforme: a.plateforme,
    identifiant: a.identifiant,
    motDePasse: decryptOrNull(a.motDePasseChiffre),
    codeSecondaire: decryptOrNull(a.codeSecondaireChiffre),
    updatedAt: a.updatedAt,
  }));

  return NextResponse.json(result);
}

// PUT /api/logements/:id/acces
// body: { plateforme: 'GMAIL' | 'AIRBNB' | 'BOOKING', identifiant, motDePasse, codeSecondaire }
// Crée ou remplace les identifiants pour cette plateforme sur ce logement.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { plateforme, identifiant, motDePasse, codeSecondaire } = body;

  if (!['GMAIL', 'AIRBNB', 'BOOKING'].includes(plateforme)) {
    return NextResponse.json({ error: 'Plateforme invalide.' }, { status: 400 });
  }

  const updated = await prisma.accesCompte.upsert({
    where: { logementId_plateforme: { logementId: id, plateforme } },
    update: {
      identifiant: identifiant ?? null,
      motDePasseChiffre: encryptOrNull(motDePasse),
      codeSecondaireChiffre: encryptOrNull(codeSecondaire),
    },
    create: {
      logementId: id,
      plateforme,
      identifiant: identifiant ?? null,
      motDePasseChiffre: encryptOrNull(motDePasse),
      codeSecondaireChiffre: encryptOrNull(codeSecondaire),
    },
  });

  return NextResponse.json({
    plateforme: updated.plateforme,
    identifiant: updated.identifiant,
    updatedAt: updated.updatedAt,
    // on ne renvoie pas le mot de passe après écriture — inutile, évite de le repromener sur le réseau
  });
}
