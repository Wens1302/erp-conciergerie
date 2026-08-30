'use client';

import { useEffect, useState, useCallback } from 'react';

type Logement = {
  id: string;
  nom: string;
  zone: { nom: string };
  nomProprietaire: string | null;
  telephoneProprietaire: string | null;
  parking: boolean | null;
  piscine: boolean | null;
  nombreChambres: number | null;
  nombreSallesDeBain: number | null;
  adresse: string | null;
  geolocalisation: string | null;
  automatisable: boolean;
  wifiInfo: string | null;
  numConcierge: string | null;
  detailsBien: string | null;
  acces: { plateforme: string; identifiant: string | null; updatedAt: string }[];
};

type AccesDetail = { plateforme: string; identifiant: string | null; motDePasse: string | null; codeSecondaire: string | null };

const PLATEFORMES = [
  { key: 'GMAIL', label: 'Accès mail (Gmail)', codeLabel: null },
  { key: 'AIRBNB', label: 'Airbnb', codeLabel: 'Code secret / 2e numéro' },
  { key: 'BOOKING', label: 'Booking', codeLabel: 'Numéro de vérification' },
];

export default function LogementsPage() {
  const [logements, setLogements] = useState<Logement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Logement | null>(null);
  const [accesDetail, setAccesDetail] = useState<Record<string, AccesDetail>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [fiche, setFiche] = useState<any>({});
  const [savingFiche, setSavingFiche] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`/api/logements?${params.toString()}`);
    setLogements(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function openLogement(l: Logement) {
    setSelected(l);
    setRevealed({});
    setFiche({
      nomProprietaire: l.nomProprietaire || '',
      telephoneProprietaire: l.telephoneProprietaire || '',
      parking: l.parking || false,
      piscine: l.piscine || false,
      nombreChambres: l.nombreChambres ?? '',
      nombreSallesDeBain: l.nombreSallesDeBain ?? '',
      adresse: l.adresse || '',
      geolocalisation: l.geolocalisation || '',
      automatisable: l.automatisable,
      wifiInfo: l.wifiInfo || '',
      numConcierge: l.numConcierge || '',
      detailsBien: l.detailsBien || '',
    });
    const res = await fetch(`/api/logements/${l.id}/acces`);
    const list: AccesDetail[] = await res.json();
    const map: Record<string, AccesDetail> = {};
    for (const p of PLATEFORMES) {
      const found = list.find((x) => x.plateforme === p.key);
      map[p.key] = found || { plateforme: p.key, identifiant: '', motDePasse: '', codeSecondaire: '' };
    }
    setAccesDetail(map);
  }

  async function saveFiche() {
    if (!selected) return;
    setSavingFiche(true);
    await fetch(`/api/logements/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fiche),
    });
    setSavingFiche(false);
    load();
  }

  async function saveAcces(plateforme: string) {
    if (!selected) return;
    const a = accesDetail[plateforme];
    await fetch(`/api/logements/${selected.id}/acces`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateforme,
        identifiant: a.identifiant,
        motDePasse: a.motDePasse,
        codeSecondaire: a.codeSecondaire,
      }),
    });
    openLogement(selected); // recharge pour confirmer la sauvegarde
  }

  return (
    <div className="wrap">
      <p className="eyebrow">Terre &amp; Mer Maroc · ERP Conciergerie</p>
      <h1>Fiches biens &amp; accès plateformes</h1>

      <nav className="top-nav">
        <a href="/dashboard">Tableau de bord</a>
        <a href="/reservations">Réservations</a>
        <a href="/logements" className="active">Biens &amp; accès</a>
      </nav>

      <div className="security-note">
        ⚠️ Les mots de passe sont chiffrés en base, mais cette page n&apos;est pas encore protégée par
        un compte utilisateur. Ne pas utiliser avec de vraies données tant que l&apos;authentification
        n&apos;est pas activée.
      </div>

      {!selected ? (
        <>
          <div className="toolbar">
            <input
              type="text"
              placeholder="Rechercher un bien, un propriétaire, une adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Chargement…</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Logement</th><th>Propriétaire</th><th>Chambres / SdB</th><th>Automatisable</th>
                  <th>Comptes renseignés</th><th></th>
                </tr>
              </thead>
              <tbody>
                {logements.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucun bien trouvé.</td></tr>
                )}
                {logements.map((l) => (
                  <tr key={l.id}>
                    <td>{l.zone.nom} — {l.nom}</td>
                    <td>{l.nomProprietaire || '—'}</td>
                    <td>{l.nombreChambres ?? '—'} / {l.nombreSallesDeBain ?? '—'}</td>
                    <td>{l.automatisable ? <span className="badge valid">Oui</span> : <span className="badge unspec">Non</span>}</td>
                    <td>{l.acces.length > 0 ? l.acces.map((a) => a.plateforme).join(', ') : '—'}</td>
                    <td><button className="btn-secondary" onClick={() => openLogement(l)}>Ouvrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <div>
          <button className="btn-secondary" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>← Retour à la liste</button>
          <h2 className="section-title">{selected.zone.nom} — {selected.nom}</h2>

          <div className="panel">
            <div className="panel-title"><span>Fiche bien</span></div>
            <div className="form-grid">
              <Field label="Nom propriétaire"><input value={fiche.nomProprietaire} onChange={(e) => setFiche({ ...fiche, nomProprietaire: e.target.value })} /></Field>
              <Field label="Num téléphone"><input value={fiche.telephoneProprietaire} onChange={(e) => setFiche({ ...fiche, telephoneProprietaire: e.target.value })} /></Field>
              <Field label="Adresse du bien"><input value={fiche.adresse} onChange={(e) => setFiche({ ...fiche, adresse: e.target.value })} /></Field>
              <Field label="Géolocalisation"><input value={fiche.geolocalisation} onChange={(e) => setFiche({ ...fiche, geolocalisation: e.target.value })} placeholder="lien Google Maps ou lat,lng" /></Field>
              <Field label="Nombre de chambres"><input type="number" value={fiche.nombreChambres} onChange={(e) => setFiche({ ...fiche, nombreChambres: e.target.value })} /></Field>
              <Field label="Nombre de salles de bain"><input type="number" value={fiche.nombreSallesDeBain} onChange={(e) => setFiche({ ...fiche, nombreSallesDeBain: e.target.value })} /></Field>
              <Field label="Parking">
                <select value={fiche.parking ? 'Oui' : 'Non'} onChange={(e) => setFiche({ ...fiche, parking: e.target.value === 'Oui' })}>
                  <option value="Non">Non</option><option value="Oui">Oui</option>
                </select>
              </Field>
              <Field label="Piscine">
                <select value={fiche.piscine ? 'Oui' : 'Non'} onChange={(e) => setFiche({ ...fiche, piscine: e.target.value === 'Oui' })}>
                  <option value="Non">Non</option><option value="Oui">Oui</option>
                </select>
              </Field>
              <Field label="Wifi (nom / mot de passe)"><input value={fiche.wifiInfo} onChange={(e) => setFiche({ ...fiche, wifiInfo: e.target.value })} /></Field>
              <Field label="Num concierge"><input value={fiche.numConcierge} onChange={(e) => setFiche({ ...fiche, numConcierge: e.target.value })} /></Field>
              <Field label="Automatisable (check-in autonome)">
                <select value={fiche.automatisable ? 'Oui' : 'Non'} onChange={(e) => setFiche({ ...fiche, automatisable: e.target.value === 'Oui' })}>
                  <option value="Non">Non</option><option value="Oui">Oui</option>
                </select>
              </Field>
              <div className="field full"><label>Détails du bien</label><input value={fiche.detailsBien} onChange={(e) => setFiche({ ...fiche, detailsBien: e.target.value })} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={saveFiche} disabled={savingFiche}>
                {savingFiche ? 'Enregistrement…' : 'Enregistrer la fiche'}
              </button>
            </div>
          </div>

          {PLATEFORMES.map((p) => (
            <div className="panel" key={p.key}>
              <div className="panel-title"><span>{p.label}</span></div>
              <div className="form-grid">
                <Field label="Identifiant">
                  <input
                    value={accesDetail[p.key]?.identifiant || ''}
                    onChange={(e) => setAccesDetail({ ...accesDetail, [p.key]: { ...accesDetail[p.key], identifiant: e.target.value } })}
                  />
                </Field>
                <Field label="Mot de passe">
                  <div className="pw-row">
                    <input
                      type={revealed[p.key] ? 'text' : 'password'}
                      value={accesDetail[p.key]?.motDePasse || ''}
                      onChange={(e) => setAccesDetail({ ...accesDetail, [p.key]: { ...accesDetail[p.key], motDePasse: e.target.value } })}
                    />
                    <button type="button" className="icon-btn" onClick={() => setRevealed({ ...revealed, [p.key]: !revealed[p.key] })}>
                      {revealed[p.key] ? 'Cacher' : 'Voir'}
                    </button>
                  </div>
                </Field>
                {p.codeLabel && (
                  <Field label={p.codeLabel}>
                    <input
                      value={accesDetail[p.key]?.codeSecondaire || ''}
                      onChange={(e) => setAccesDetail({ ...accesDetail, [p.key]: { ...accesDetail[p.key], codeSecondaire: e.target.value } })}
                    />
                  </Field>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn-primary" onClick={() => saveAcces(p.key)}>Enregistrer {p.label}</button>
              </div>
            </div>
          ))}
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
