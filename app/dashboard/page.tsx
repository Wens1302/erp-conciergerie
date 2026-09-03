'use client';

import { useEffect, useState, useCallback } from 'react';

const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fromISO(s: string) {
  return new Date(s + 'T00:00:00.000Z');
}
function todayISO() {
  return fmtISO(new Date());
}

type DayData = {
  date: string;
  outs: { id: string; nomVoyageur: string; logementNom: string; heureCheckout: string | null }[];
  ins: { id: string; nomVoyageur: string; logementNom: string; heureCheckin: string | null }[];
  tasks: {
    logementId: string;
    date: string;
    logementNom: string;
    proprietaire: string | null;
    checkoutTime: string | null;
    nextCheckinTime: string | null;
    keyBox: boolean;
    code: string | null;
    urgent: boolean;
    overdue: boolean;
    fait: boolean;
  }[];
};

type StripDay = { date: string; outs: number; ins: number; urgent: number };

export default function DashboardPage() {
  const [currentISO, setCurrentISO] = useState(todayISO());
  const [data, setData] = useState<DayData | null>(null);
  const [strip, setStrip] = useState<StripDay[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDay = useCallback(async (iso: string) => {
    setLoading(true);
    const res = await fetch(`/api/dashboard/day?date=${iso}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  const loadStrip = useCallback(async (iso: string) => {
    const res = await fetch(`/api/dashboard/strip?center=${iso}&days=12`);
    const json = await res.json();
    setStrip(json);
  }, []);

  useEffect(() => {
    loadDay(currentISO);
    loadStrip(currentISO);
  }, [currentISO, loadDay, loadStrip]);

  function shiftDay(delta: number) {
    const d = fromISO(currentISO);
    d.setUTCDate(d.getUTCDate() + delta);
    setCurrentISO(fmtISO(d));
  }

  async function toggleTask(logementId: string, date: string) {
    await fetch('/api/cleaning-tasks/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logementId, date }),
    });
    loadDay(currentISO);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const d = fromISO(currentISO);
  const label = `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

  return (
    <div className="wrap">
      <p className="eyebrow">Terre &amp; Mer Maroc · ERP Conciergerie</p>
      <h1>Tableau de bord</h1>

      <nav className="top-nav">
        <a href="/dashboard" className="active">Tableau de bord</a>
        <a href="/reservations">Réservations</a>
        <a href="/logements">Biens &amp; accès</a>
        <button type="button" onClick={logout}>Deconnexion</button>
      </nav>

      <div className="datenav">
        <button className="navbtn" onClick={() => shiftDay(-1)} aria-label="Jour précédent">‹</button>
        <div className="today-label">{label}</div>
        <button className="navbtn" onClick={() => shiftDay(1)} aria-label="Jour suivant">›</button>
        <button className="today-btn" onClick={() => setCurrentISO(todayISO())}>Aujourd&apos;hui</button>
      </div>

      <div className="daystrip">
        {strip.map((s) => (
          <div
            key={s.date}
            className={`daychip ${s.date === currentISO ? 'active' : ''} ${s.date === todayISO() ? 'is-today' : ''}`}
            onClick={() => setCurrentISO(s.date)}
          >
            <span className="dow">{DOW[fromISO(s.date).getUTCDay()]}</span>
            <span className="dnum">{fromISO(s.date).getUTCDate()}</span>
            <div className="dots">
              {s.outs > 0 && <span className="dot out" />}
              {s.ins > 0 && <span className="dot in" />}
              {s.urgent > 0 && <span className="dot urgent" />}
            </div>
          </div>
        ))}
      </div>

      {loading || !data ? (
        <p>Chargement…</p>
      ) : (
        <>
          <div className="summary">
            <div className="card urgent"><div className="num">{data.tasks.filter((t) => t.urgent).length}</div><div className="lbl">Ménages urgents</div></div>
            <div className="card"><div className="num">{data.tasks.length}</div><div className="lbl">Ménages à faire</div></div>
            <div className="card out"><div className="num">{data.outs.length}</div><div className="lbl">Départs</div></div>
            <div className="card in"><div className="num">{data.ins.length}</div><div className="lbl">Arrivées</div></div>
          </div>

          <div className="dash-grid">
            <div>
              <h2 className="section-title">Ménages du jour {data.tasks.length > 0 && `(${data.tasks.length})`}</h2>
              {data.tasks.length === 0 ? (
                <div className="empty-state">Aucun ménage prévu ce jour-là.</div>
              ) : (
                data.tasks.map((t) => (
                  <div key={`${t.logementId}-${t.date}`} className={`task ${t.urgent ? 'urgent' : ''} ${t.fait ? 'done' : ''}`}>
                    <div className={`task-check ${t.fait ? 'checked' : ''}`} onClick={() => toggleTask(t.logementId, t.date)}>
                      {t.fait && '✓'}
                    </div>
                    <div className="task-body">
                      <div className="task-top">
                        <span className="logement">{t.logementNom}</span>
                        <span className={`badge ${t.urgent ? 'urgent' : t.overdue ? 'late' : 'normal'}`}>
                          {t.urgent ? 'Urgent · Recouche' : 'Standard'}
                        </span>
                      </div>
                      <div className="task-meta">
                        <span>👤 {t.proprietaire || '—'}</span>
                        {t.checkoutTime && <span>🕐 Départ {t.checkoutTime}</span>}
                        {t.keyBox && <span>🔑 Boîte{t.code ? ` · ${t.code}` : ''}</span>}
                      </div>
                      {t.overdue && (
                        <div className="task-note">
                          Report du {fromISO(t.date).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                      {t.urgent && (
                        <div className="task-note">
                          Nouvelle arrivée le jour même{t.nextCheckinTime ? ` à ${t.nextCheckinTime}` : ''} — à traiter en priorité
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <div className="panel">
                <div className="panel-title"><span>Arrivées</span><span>{data.ins.length || ''}</span></div>
                <div className="mini">
                  {data.ins.length === 0 && <div className="empty-state">Aucune arrivée.</div>}
                  {data.ins.map((r) => (
                    <div key={r.id} className="mini-item in">
                      <div><div className="who">{r.nomVoyageur}</div><div className="where">{r.logementNom}</div></div>
                      <span className="time">{r.heureCheckin || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-title"><span>Départs</span><span>{data.outs.length || ''}</span></div>
                <div className="mini">
                  {data.outs.length === 0 && <div className="empty-state">Aucun départ.</div>}
                  {data.outs.map((r) => (
                    <div key={r.id} className="mini-item out">
                      <div><div className="who">{r.nomVoyageur}</div><div className="where">{r.logementNom}</div></div>
                      <span className="time">{r.heureCheckout || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
