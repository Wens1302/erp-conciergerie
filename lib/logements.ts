import { prisma } from './prisma';

/**
 * Le sheet d'origine décrit un logement par : zone + bâtiment + numéro d'appartement.
 * Cette fonction retrouve le Logement correspondant s'il existe déjà, ou le crée
 * (ainsi que la Zone si besoin) — pour que le formulaire de réservation puisse
 * rester "à plat" comme dans le sheet, sans obliger l'utilisateur à gérer les
 * logements séparément.
 */
export async function resolveLogement(fields: {
  zoneNom?: string | null;
  batiment?: string | null;
  numero?: string | null;
  etage?: string | null;
  boiteACles?: boolean;
  codeCles?: string | null;
  nombreAppartements?: number | null;
  nomProprietaire?: string | null;
}) {
  const zoneNom = (fields.zoneNom || 'Zone non spécifiée').trim();
  const batiment = fields.batiment?.trim() || null;
  const numero = fields.numero?.trim() || null;

  const zone = await prisma.zone.upsert({
    where: { nom: zoneNom },
    update: {},
    create: { nom: zoneNom },
  });

  const nomLogement = [zoneNom, batiment, numero ? `App.${numero}` : null]
    .filter(Boolean)
    .join(' - ');

  const existingLogement = await prisma.logement.findFirst({
    where: {
      zoneId: zone.id,
      batiment,
      numero,
    },
  });

  const logement = existingLogement
    ? await prisma.logement.update({
        where: { id: existingLogement.id },
        data: {
          etage: fields.etage ?? undefined,
          boiteACles: fields.boiteACles ?? undefined,
          codeCles: fields.codeCles ?? undefined,
          nombreAppartements: fields.nombreAppartements ?? undefined,
          nomProprietaire: fields.nomProprietaire ?? undefined,
        },
      })
    : await prisma.logement.create({
        data: {
          nom: nomLogement || 'Logement sans nom',
          zoneId: zone.id,
          batiment,
          numero,
          etage: fields.etage || null,
          boiteACles: fields.boiteACles ?? false,
          codeCles: fields.codeCles || null,
          nombreAppartements: fields.nombreAppartements ?? null,
          nomProprietaire: fields.nomProprietaire || null,
        },
      });

  return logement;
}
