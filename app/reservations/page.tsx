'use client';

import { useEffect, useState, useCallback } from 'react';

type Reservation = {
  id: string;
  nomVoyageur: string;
  siteReservation: string;
  statut: 'VALIDEE' | 'NON_SPECIFIEE' | 'ANNULEE';
  dateArrivee: string;
  dateDepart: string;
  heureCheckin: string | null;
  heureCheckout: string | null;
  pieceIdentite: boolean;
  observations: string | null;
  logement: {
    nom: string;
    batiment: string | null;
    numero: string | null;
    etage: string | null;
    boiteACles: boolean;
    codeCles: string | null;
    nombreAppartements: number | null;
    nomProprietaire: string | null;
    zone: { nom: string };
  };
};

const emptyForm = {
  nomProprietaire: '',
  nomVoyageurs: '',
  zoneAppartement: '',
  batiment: '',
  numeroAppartement: '',
  etage: '',
  boiteACles: false,
  codeCles: '',
  nombreAppartements: '',
  siteReservation: 'Airbnb',
  statutReservation: 'VALIDEE',
  dateArrivee: '',
  dateDepart: '',
  checkIn: '',
  checkOut: '',
  pieceIdentite: true,
  observations: '',
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statutFilter !== 'all') params.set('statut', statutFilter);
    const res = await fetch(`/api/reservations?${params.toString()}`);
    const data = await res.json();
    setReservations(data);
    setLoading(false);
  }, [search, statutFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce la recherche
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(r: Reservation) {
    setEditingId(r.id);
    setForm({
      nomProprietaire: r.logement.nomProprietaire || '',
      nomVoyageurs: r.nomVoyageur,
      zoneAppartement: r.logement.zone.nom,
      batiment: r.logement.batiment || '',
      numeroAppartement: r.logement.numero || '',
      etage: r.logement.etage || '',
      boiteACles: r.logement.boiteACles,
      codeCles: r.logement.codeCles || '',
      nombreAppartements: r.logement.nombreAppartements ?? '',
      siteReservation: r.siteReservation,
      statutReservation: r.statut,
      dateArrivee: r.dateArrivee.slice(0, 10),
      dateDepart: r.dateDepart.slice(0, 10),
      checkIn: r.heureCheckin || '',
      checkOut: r.heureCheckout || '',
      pieceIdentite: r.pieceIdentite,
      observations: r.observations || '',
    });
    setError(null);
    setModalOpen(true);
  }

  async function submitForm() {
    setError(null);
    const url = editingId ? `/api/reservations/${editingId}` : '/api/reservations';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Une erreur est survenue.');
      return;
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette réservation ?')) return;
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
    load();
  }

  function statusBadgeClass(s: string) {
    if (s === 'VALIDEE') return 'valid';
    if (s === 'ANNULEE') return 'cancelled';
    return 'unspec';
  }
  function statusLabel(s: string) {
    if (s === 'VALIDEE') return 'Validée';
    if (s === 'ANNULEE') return 'Annulée';
    return 'Non spécifiée';
  }
  function fmt(d: string) {
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR');
  }

  return (
    <div className="wrap">
      <p className="eyebrow">Terre &amp; Mer Maroc · ERP Conciergerie</p>
      <h1>Réservations</h1>

      <nav className="top-nav">
        <a href="/dashboard">Tableau de bord</a>
        <a href="/reservations" className="active">Réservations</a>
        <a href="/logements">Biens &amp; accès</a>
      </nav>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Rechercher un logement, un voyageur, un propriétaire…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="VALIDEE">Validée</option>
          <option value="NON_SPECIFIEE">Non spécifiée</option>
          <option value="ANNULEE">Annulée</option>
        </select>
        <button className="btn-primary" onClick={openCreate}>
          + Nouvelle réservation
        </button>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Logement</th>
              <th>Voyageur</th>
              <th>Propriétaire</th>
              <th>Arrivée</th>
              <th>Départ</th>
              <th>Site</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                  Aucune réservation ne correspond.
                </td>
              </tr>
            )}
            {reservations.map((r) => (
              <tr key={r.id} className={r.statut === 'ANNULEE' ? 'cancelled' : ''}>
                <td>{r.logement.zone.nom}{r.logement.batiment ? ` - ${r.logement.batiment}` : ''}{r.logement.numero ? ` - App.${r.logement.numero}` : ''}</td>
                <td>{r.nomVoyageur}</td>
                <td>{r.logement.nomProprietaire || '—'}</td>
                <td>{fmt(r.dateArrivee)}</td>
                <td>{fmt(r.dateDepart)}</td>
                <td>{r.siteReservation}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(r.statut)}`}>{statusLabel(r.statut)}</span>
                </td>
                <td>
                  <button className="icon-btn" title="Modifier" onClick={() => openEdit(r)}>✎</button>
                  <button className="icon-btn del" title="Supprimer" onClick={() => remove(r.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="overlay open" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>{editingId ? 'Modifier la réservation' : 'Nouvelle réservation'}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Mêmes champs que le sheet d&apos;origine.
            </p>

            <div className="form-grid">
              <Field label="Nom propriétaire">
                <input value={form.nomProprietaire} onChange={(e) => setForm({ ...form, nomProprietaire: e.target.value })} />
              </Field>
              <Field label="Nom voyageur(s)">
                <input value={form.nomVoyageurs} onChange={(e) => setForm({ ...form, nomVoyageurs: e.target.value })} />
              </Field>
              <Field label="Zone d'appartement">
                <input value={form.zoneAppartement} onChange={(e) => setForm({ ...form, zoneAppartement: e.target.value })} placeholder="ex. Malabata" />
              </Field>
              <Field label="Bâtiment / Résidence">
                <input value={form.batiment} onChange={(e) => setForm({ ...form, batiment: e.target.value })} placeholder="optionnel" />
              </Field>
              <Field label="N° appartement">
                <input value={form.numeroAppartement} onChange={(e) => setForm({ ...form, numeroAppartement: e.target.value })} />
              </Field>
              <Field label="Étage">
                <input value={form.etage} onChange={(e) => setForm({ ...form, etage: e.target.value })} />
              </Field>
              <Field label="Nombre d'appartements">
                <input type="number" value={form.nombreAppartements} onChange={(e) => setForm({ ...form, nombreAppartements: e.target.value })} />
              </Field>
              <Field label="Boîte à clés">
                <select value={form.boiteACles ? 'Oui' : 'Non'} onChange={(e) => setForm({ ...form, boiteACles: e.target.value === 'Oui' })}>
                  <option value="Non">Non</option>
                  <option value="Oui">Oui</option>
                </select>
              </Field>
              <Field label="Code boîte à clés">
                <input value={form.codeCles} onChange={(e) => setForm({ ...form, codeCles: e.target.value })} />
              </Field>
              <Field label="Site de réservation">
                <select value={form.siteReservation} onChange={(e) => setForm({ ...form, siteReservation: e.target.value })}>
                  <option>Airbnb</option>
                  <option>Booking</option>
                  <option>Direct</option>
                </select>
              </Field>
              <Field label="Statut">
                <select value={form.statutReservation} onChange={(e) => setForm({ ...form, statutReservation: e.target.value })}>
                  <option value="VALIDEE">Validée</option>
                  <option value="NON_SPECIFIEE">Non spécifiée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
              </Field>
              <Field label="Date d'arrivée">
                <input type="date" value={form.dateArrivee} onChange={(e) => setForm({ ...form, dateArrivee: e.target.value })} />
              </Field>
              <Field label="Date de départ">
                <input type="date" value={form.dateDepart} onChange={(e) => setForm({ ...form, dateDepart: e.target.value })} />
              </Field>
              <Field label="Heure check-in">
                <input type="time" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              </Field>
              <Field label="Heure check-out">
                <input type="time" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
              </Field>
              <Field label="Pièce d'identité fournie">
                <select value={form.pieceIdentite ? 'Oui' : 'Non'} onChange={(e) => setForm({ ...form, pieceIdentite: e.target.value === 'Oui' })}>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </Field>
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label>Observations</label>
                <input value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
              <button className="btn-primary" onClick={submitForm}>
                {editingId ? 'Enregistrer les modifications' : 'Ajouter la réservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
