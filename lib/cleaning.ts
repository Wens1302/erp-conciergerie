// Logique de priorité des ménages — identique à celle du MVP :
// un départ devient "urgent" uniquement si une arrivée est prévue le même
// jour dans le MÊME logement (turnover / recouche).

export type ReservationLite = {
  id: string;
  nomVoyageur: string;
  siteReservation: string;
  statut: string;
  dateArrivee: Date;
  dateDepart: Date;
  heureCheckin: string | null;
  heureCheckout: string | null;
  logement: {
    id: string;
    nom: string;
    boiteACles: boolean;
    codeCles: string | null;
    nomProprietaire: string | null;
    zone: { nom: string };
  };
};

export type CleaningTask = {
  logementId: string;
  logementNom: string;
  proprietaire: string | null;
  checkoutTime: string | null;
  nextCheckinTime: string | null;
  keyBox: boolean;
  code: string | null;
  urgent: boolean;
};

function sameYMD(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function splitDay(reservations: ReservationLite[], day: Date) {
  const active = reservations.filter((r) => r.statut !== 'ANNULEE');
  const outs = active.filter((r) => sameYMD(r.dateDepart, day));
  const ins = active.filter((r) => sameYMD(r.dateArrivee, day));
  return { outs, ins };
}

export function buildCleaningTasks(outs: ReservationLite[], ins: ReservationLite[]): CleaningTask[] {
  const insByLogement = new Map(ins.map((r) => [r.logement.id, r]));

  const tasks: CleaningTask[] = outs.map((r) => {
    const matchingIn = insByLogement.get(r.logement.id);
    const urgent = Boolean(matchingIn);
    return {
      logementId: r.logement.id,
      logementNom: r.logement.nom,
      proprietaire: r.logement.nomProprietaire,
      checkoutTime: r.heureCheckout,
      nextCheckinTime: urgent ? matchingIn!.heureCheckin : null,
      keyBox: r.logement.boiteACles,
      code: r.logement.codeCles,
      urgent,
    };
  });

  tasks.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return (a.checkoutTime || '99:99').localeCompare(b.checkoutTime || '99:99');
  });

  return tasks;
}
