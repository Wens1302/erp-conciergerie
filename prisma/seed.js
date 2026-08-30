// Réimporte les 193 réservations historiques (déjà nettoyées lors du MVP)
// dans la vraie base de données. À lancer une fois après `prisma db push` :
//   node prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parseCsv(content) {
  const lines = content.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ''));
    return row;
  });
}

// Parseur CSV simple qui gère les guillemets et les virgules à l'intérieur des champs
function parseCsvLine(line) {
  const out = [];
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
  return out.map((v) => (v === '' ? null : v));
}

function toStatutEnum(s) {
  if (s === 'Validée') return 'VALIDEE';
  if (s === 'Annulée') return 'ANNULEE';
  return 'NON_SPECIFIEE';
}

async function main() {
  const csvPath = path.join(__dirname, 'reservations_clean.csv');
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));

  let created = 0;
  for (const row of rows) {
    if (!row["Date d'arrivée"] || !row['Date de départ']) continue;

    const zoneNom = row["Zone d'appartement"] || 'Zone non spécifiée';
    const batiment = row['Bâtiment / Résidence'] || null;
    const numero = row["Numéro d'appartement"] ? String(parseInt(row["Numéro d'appartement"])) : null;

    const zone = await prisma.zone.upsert({
      where: { nom: zoneNom },
      update: {},
      create: { nom: zoneNom },
    });

    const nomLogement = [zoneNom, batiment, numero ? `App.${numero}` : null].filter(Boolean).join(' - ');

    const logement = await prisma.logement.upsert({
      where: { zoneId_batiment_numero: { zoneId: zone.id, batiment, numero } },
      update: {},
      create: {
        nom: nomLogement || 'Logement sans nom',
        zoneId: zone.id,
        batiment,
        numero,
        etage: row['Etage'] || null,
        boiteACles: row['Boîte à clés'] === 'Oui',
        codeCles: row['Code boîte à clés'] || null,
        nomProprietaire: row['Nom du propriétaire'] || null,
      },
    });

    await prisma.reservation.create({
      data: {
        logementId: logement.id,
        nomVoyageur: row['Nom voyageurs'] || 'Voyageur non spécifié',
        siteReservation: row['Site de réservation'] || 'Airbnb',
        statut: toStatutEnum(row['Satut de réservation']),
        dateArrivee: new Date(row["Date d'arrivée"]),
        dateDepart: new Date(row['Date de départ']),
        heureCheckin: row['Check-in (heure)'] || null,
        heureCheckout: row['Check-out (heure)'] || null,
        pieceIdentite: row["Pièces d'identité fournies"] === 'Oui',
      },
    });
    created++;
  }

  console.log(`Import terminé : ${created} réservations créées.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
