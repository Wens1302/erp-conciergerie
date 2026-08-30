// Mappe le payload "à plat" (mêmes champs que le sheet d'origine) reçu du
// formulaire vers les champs Reservation + Logement en base.
export function parseReservationPayload(body: any) {
  return {
    logementFields: {
      zoneNom: body.zoneAppartement,
      batiment: body.batiment,
      numero: body.numeroAppartement,
      etage: body.etage,
      boiteACles: body.boiteACles === true || body.boiteACles === 'Oui',
      codeCles: body.codeCles,
      nombreAppartements: body.nombreAppartements ? Number(body.nombreAppartements) : null,
      nomProprietaire: body.nomProprietaire,
    },
    reservationFields: {
      nomVoyageur: body.nomVoyageurs,
      siteReservation: body.siteReservation || 'Airbnb',
      statut: body.statutReservation || 'VALIDEE',
      dateArrivee: body.dateArrivee ? new Date(body.dateArrivee) : null,
      dateDepart: body.dateDepart ? new Date(body.dateDepart) : null,
      heureCheckin: body.checkIn || null,
      heureCheckout: body.checkOut || null,
      pieceIdentite: body.pieceIdentite === true || body.pieceIdentite === 'Oui',
      observations: body.observations || null,
    },
  };
}
