/**
 * Import des réservations depuis le CSV vers la base Neon/PostgreSQL via Prisma.
 *
 * Usage :
 *   npx tsx scripts/import-reservations.ts --dry-run   (simulation, n'écrit rien)
 *   npx tsx scripts/import-reservations.ts             (import réel)
 *   npx tsx scripts/import-reservations.ts --file=chemin/vers/fichier.csv
 *
 * Fichiers inspectés avant d'écrire ce script :
 *   - prisma/schema.prisma  (modèles Zone, Logement, Reservation, enum StatutReservation)
 *   - prisma/reservations_clean.csv (193 lignes réelles, en-têtes et valeurs)
 *   - package.json (aucune librairie CSV déjà installée → parseur maison, comme dans prisma/seed.js)
 *
 * Stratégie d'identification du logement : (zoneId, batiment, numero) — c'est la contrainte
 * @@unique déjà présente dans le schéma. Vérifié sur les 193 lignes réelles : aucune collision
 * (deux lignes avec la même combinaison zone+bâtiment+numéro ont toujours le même nom de
 * logement). On n'a donc PAS besoin de changer le schéma. Le nom complet "Logement" du CSV
 * sert uniquement de vérification croisée (si jamais deux lignes avec la même clé ont des noms
 * différents, c'est signalé comme incohérence plutôt que fusionné silencieusement).
 *
 * Attention connue sur ces données réelles : 5 lignes ont zone="Malabata", bâtiment et numéro
 * vides (le sheet d'origine ne précisait pas l'appartement). Elles seront fusionnées dans UN
 * seul logement générique "Malabata" — c'est une limite des données sources, pas du script.
 * Elles apparaissent dans le rapport final sous "lignes à vérifier".
 *
 * Déduplication des réservations : (logementId, dateArrivee, dateDepart, nomVoyageur normalisé).
 * Il n'y a pas de contrainte unique en base sur Reservation (volontaire, pour ne pas bloquer un
 * futur cas légitime de double réservation du même voyageur) — la déduplication se fait donc
 * ici, dans le script, par une recherche explicite avant chaque création.
 */

import { PrismaClient, StatutReservation } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ---------- arguments ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fileArg = args.find((a) => a.startsWith('--file='));
const CSV_CANDIDATES = fileArg
  ? [fileArg.slice('--file='.length)]
  : ['prisma/reservations_clean.csv', 'reservations_clean.csv', 'data/reservations_clean.csv'];

// ---------- parseur CSV (gère les guillemets, pas de dépendance externe) ----------
function parseCsvLine(line: string): (string | null)[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v);
}

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
  // Retire un éventuel BOM UTF-8 en tête de fichier
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]).map((h) => (h || '').trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => (row[h] = (values[i] ?? '').trim()));
    return row;
  });
}

// ---------- nettoyage / normalisation ----------
function cleanText(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function normalizeOuiNon(v: string | undefined): boolean {
  const t = (v || '').trim().toLowerCase();
  return t === 'oui';
}

function normalizeNumero(v: string | undefined): string | null {
  const t = (v || '').trim();
  if (!t) return null;
  // Le CSV contient des nombres flottants type "10.0" (export Excel/Sheets) → on nettoie
  const n = parseFloat(t.replace(',', '.'));
  if (Number.isNaN(n)) return t; // valeur non numérique (rare) : on la garde telle quelle
  return String(Math.trunc(n));
}

function normalizeStatut(v: string | undefined): StatutReservation {
  const t = (v || '').trim().toLowerCase();
  if (t === 'validée' || t === 'validee') return 'VALIDEE';
  if (t === 'annulée' || t === 'annulee') return 'ANNULEE';
  return 'NON_SPECIFIEE'; // valeur absente, vide, ou non reconnue
}

// Le CSV nettoyé en amont utilise déjà le format YYYY-MM-DD. On garde un filet de sécurité
// pour un éventuel format DD/MM/YYYY ou DD/MM/YY si jamais un autre export est utilisé un jour.
function parseDate(v: string | undefined): Date | null {
  const t = (v || '').trim();
  if (!t) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t + 'T00:00:00.000Z');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/?(\d{2,4})?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : 2026;
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeVoyageurKey(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------- rapport ----------
type Issue = { ligne: number; logement: string; voyageur: string; probleme: string };

const report = {
  lignesAnalysees: 0,
  zonesCreees: 0,
  logementsCrees: 0,
  reservationsCreees: 0,
  doublonsIgnores: 0,
  erreurs: 0,
  issues: [] as Issue[],
};

function addIssue(ligne: number, logement: string, voyageur: string, probleme: string) {
  report.issues.push({ ligne, logement, voyageur, probleme });
}

// ---------- main ----------
async function main() {
  const csvPath = CSV_CANDIDATES.map((p) => path.resolve(process.cwd(), p)).find((p) => fs.existsSync(p));
  if (!csvPath) {
    console.error(`Aucun fichier CSV trouvé parmi : ${CSV_CANDIDATES.join(', ')}`);
    console.error('Précise le chemin avec --file=chemin/vers/ton-fichier.csv');
    process.exit(1);
  }
  console.log(`Fichier CSV : ${csvPath}`);
  console.log(DRY_RUN ? 'Mode : DRY-RUN (aucune écriture en base)\n' : 'Mode : IMPORT RÉEL\n');

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  report.lignesAnalysees = rows.length;

  // Caches en mémoire pour éviter une requête DB par ligne
  const zoneCache = new Map<string, string>(); // nom zone -> id
  const logementCache = new Map<string, { id: string; nom: string }>(); // clé composite -> {id, nom}

  // Pré-charge les zones/logements déjà en base (utile pour --dry-run ET pour limiter les requêtes)
  const existingZones = await prisma.zone.findMany();
  existingZones.forEach((z) => zoneCache.set(z.nom, z.id));

  const existingLogements = await prisma.logement.findMany();
  existingLogements.forEach((l) =>
    logementCache.set(logementKey(l.zoneId, l.batiment, l.numero), { id: l.id, nom: l.nom })
  );

  function logementKey(zoneId: string, batiment: string | null, numero: string | null) {
    return `${zoneId}::${batiment ?? ''}::${numero ?? ''}`;
  }

  // zones/logements "virtuels" créés pendant un dry-run (pas en base, juste pour la cohérence du rapport)
  const dryRunZoneIds = new Map<string, string>(); // nom -> id fictif
  const dryRunLogementKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const ligneNo = i + 2; // +1 pour l'en-tête, +1 pour l'index 0-based
    const row = rows[i];

    const nomVoyageur = cleanText(row['Nom voyageurs']) || 'Voyageur non spécifié';
    const nomLogementCsv = cleanText(row['Logement']) || '';
    const zoneNom = cleanText(row["Zone d'appartement"]);
    const dateArrivee = parseDate(row["Date d'arrivée"]);
    const dateDepart = parseDate(row['Date de départ']);

    if (!zoneNom) {
      addIssue(ligneNo, nomLogementCsv, nomVoyageur, 'Zone manquante — ligne ignorée');
      report.erreurs++;
      continue;
    }
    if (!dateArrivee || !dateDepart) {
      addIssue(ligneNo, nomLogementCsv, nomVoyageur, "Date d'arrivée ou de départ invalide/manquante — ligne ignorée");
      report.erreurs++;
      continue;
    }

    const batiment = cleanText(row['Bâtiment / Résidence']);
    const numero = normalizeNumero(row["Numéro d'appartement"]);
    const etage = cleanText(row['Etage']);
    const boiteACles = normalizeOuiNon(row['Boîte à clés']);
    const codeCles = cleanText(row['Code boîte à clés']);
    const nomProprietaire = cleanText(row['Nom du propriétaire']);

    if (!batiment && !numero) {
      addIssue(
        ligneNo,
        nomLogementCsv,
        nomVoyageur,
        'Bâtiment ET numéro absents — sera rattaché à un logement générique pour cette zone'
      );
    }

    try {
      // ---- 1. Zone ----
      let zoneId = zoneCache.get(zoneNom);
      if (!zoneId) {
        if (DRY_RUN) {
          zoneId = dryRunZoneIds.get(zoneNom) || `dryrun-zone-${dryRunZoneIds.size + 1}`;
          dryRunZoneIds.set(zoneNom, zoneId);
          report.zonesCreees++;
        } else {
          const zone = await prisma.zone.create({ data: { nom: zoneNom } });
          zoneId = zone.id;
          report.zonesCreees++;
        }
        zoneCache.set(zoneNom, zoneId);
      }

      // ---- 2. Logement (find or create — jamais dupliqué pour la même combinaison) ----
      const key = logementKey(zoneId, batiment, numero);
      let logement = logementCache.get(key);

      const nomLogementCalcule =
        nomLogementCsv || [zoneNom, batiment, numero ? `App.${numero}` : null].filter(Boolean).join(' - ');

      if (logement) {
        // Vérification croisée : le nom du CSV correspond-il à ce qu'on a déjà ?
        if (nomLogementCsv && logement.nom !== nomLogementCsv) {
          addIssue(
            ligneNo,
            nomLogementCsv,
            nomVoyageur,
            `Incohérence de nom pour la même clé zone/bâtiment/numéro : base="${logement.nom}" vs CSV="${nomLogementCsv}"`
          );
        }
      } else {
        if (DRY_RUN) {
          logement = { id: `dryrun-logement-${dryRunLogementKeys.size + 1}`, nom: nomLogementCalcule };
          dryRunLogementKeys.add(key);
          report.logementsCrees++;
        } else {
          const created = await prisma.logement.create({
            data: {
              nom: nomLogementCalcule,
              zoneId,
              batiment,
              numero,
              etage,
              boiteACles,
              codeCles,
              nomProprietaire,
            },
          });
          logement = { id: created.id, nom: created.nom };
          report.logementsCrees++;
        }
        logementCache.set(key, logement);
      }

      // ---- 3. Détection de doublon de réservation ----
      const voyageurKey = normalizeVoyageurKey(nomVoyageur);
      let isDuplicate = false;

      if (!DRY_RUN && !logement.id.startsWith('dryrun-')) {
        const existing = await prisma.reservation.findFirst({
          where: { logementId: logement.id, dateArrivee, dateDepart },
        });
        if (existing && normalizeVoyageurKey(existing.nomVoyageur) === voyageurKey) {
          isDuplicate = true;
        }
      }
      // En dry-run avec un logement fictif, on ne peut pas interroger la base pour ce logement
      // (il n'existe pas encore) — donc pas de doublon possible par construction.

      if (isDuplicate) {
        report.doublonsIgnores++;
        continue;
      }

      // ---- 4. Création de la réservation ----
      if (!DRY_RUN) {
        await prisma.reservation.create({
          data: {
            logementId: logement.id,
            nomVoyageur,
            siteReservation: cleanText(row['Site de réservation']) || 'Airbnb',
            statut: normalizeStatut(row['Satut de réservation']),
            dateArrivee,
            dateDepart,
            heureCheckin: cleanText(row['Check-in (heure)']),
            heureCheckout: cleanText(row['Check-out (heure)']),
            pieceIdentite: normalizeOuiNon(row["Pièces d'identité fournies"]),
          },
        });
      }
      report.reservationsCreees++;
    } catch (err: any) {
      report.erreurs++;
      addIssue(ligneNo, nomLogementCsv, nomVoyageur, `Erreur : ${err?.message || err}`);
    }
  }

  // ---------- rapport final ----------
  console.log('========================================');
  console.log(DRY_RUN ? 'DRY-RUN TERMINÉ (rien n\'a été écrit)' : 'IMPORT TERMINÉ');
  console.log('========================================');
  console.log(`✓ Lignes CSV analysées : ${report.lignesAnalysees}`);
  console.log(`✓ Zones créées          : ${report.zonesCreees}`);
  console.log(`✓ Logements créés       : ${report.logementsCrees}`);
  console.log(`✓ Réservations créées   : ${report.reservationsCreees}`);
  console.log(`↳ Doublons ignorés      : ${report.doublonsIgnores}`);
  console.log(`⚠ Lignes à vérifier     : ${report.issues.length}`);
  console.log(`✗ Erreurs               : ${report.erreurs}`);

  if (report.issues.length > 0) {
    console.log('\n--- Détail des lignes à vérifier ---');
    for (const issue of report.issues) {
      console.log(`  Ligne ${issue.ligne} | ${issue.logement || '(logement inconnu)'} | ${issue.voyageur} → ${issue.probleme}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Erreur fatale :', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
