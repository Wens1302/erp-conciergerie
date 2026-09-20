'use client';

import { useEffect, useMemo, useState } from 'react';

type BoardTask = {
  logementId: string;
  date: string;
  logementNom: string;
  proprietaire: string | null;
  checkoutTime: string | null;
  urgent: boolean;
  fait: boolean;
  faitLe: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  faitParName: string | null;
};

type BoardGroup = {
  assigneeUserId: string | null;
  assigneeName: string;
  total: number;
  done: number;
  urgent: number;
  tasks: BoardTask[];
};

type BoardData = {
  month: string;
  start: string;
  end: string;
  total: number;
  done: number;
  groups: BoardGroup[];
};

const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fromISO(s: string) {
  return new Date(s + 'T00:00:00.000Z');
}

function buildWeeks(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthNumber, 1));
  const weeks = [];
  let cursor = new Date(monthStart);
  let index = 1;

  while (cursor < monthEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + (7 - end.getUTCDay()));
    if (end > monthEnd) end.setTime(monthEnd.getTime());
    weeks.push({
      id: String(index),
      label: `Semaine ${index} (${start.getUTCDate()}-${new Date(end.getTime() - 86400000).getUTCDate()})`,
      start: fmtISO(start),
      end: fmtISO(end),
    });
    cursor = end;
    index++;
  }

  return weeks;
}

export default function MenagesPage() {
  const [month, setMonth] = useState(currentMonth());
  const [weekId, setWeekId] = useState('all');
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);

  const weeks = useMemo(() => buildWeeks(month), [month]);
  const selectedWeek = weeks.find((week) => week.id === weekId);

  useEffect(() => {
    if (weekId !== 'all' && !weeks.some((week) => week.id === weekId)) {
      setWeekId('all');
    }
  }, [weekId, weeks]);

  useEffect(() => {
    const params = new URLSearchParams({ month });
    if (selectedWeek) {
      params.set('start', selectedWeek.start);
      params.set('end', selectedWeek.end);
    }

    setLoading(true);
    fetch(`/api/cleaning-tasks/board?${params.toString()}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, selectedWeek]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="wrap">
      <p className="eyebrow">Terre &amp; Mer Maroc · ERP Conciergerie</p>
      <h1>Board menages</h1>

      <nav className="top-nav">
        <a href="/dashboard">Tableau de bord</a>
        <a href="/menages" className="active">Board menages</a>
        <a href="/reservations">Reservations</a>
        <a href="/logements">Biens &amp; acces</a>
        <button type="button" onClick={logout}>Deconnexion</button>
      </nav>

      <div className="board-toolbar">
        <label>
          <span>Mois</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label>
          <span>Semaine</span>
          <select value={weekId} onChange={(e) => setWeekId(e.target.value)}>
            <option value="all">Tout le mois</option>
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>{week.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading || !data ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="summary">
            <div className="card"><div className="num">{data.total}</div><div className="lbl">Menages prevus</div></div>
            <div className="card in"><div className="num">{data.done}</div><div className="lbl">Menages faits</div></div>
            <div className="card urgent"><div className="num">{data.total - data.done}</div><div className="lbl">Restants</div></div>
            <div className="card out"><div className="num">{data.groups.filter((g) => g.total > 0).length}</div><div className="lbl">Dames actives</div></div>
          </div>

          <div className="board-groups">
            {data.groups.map((group) => (
              <section className="board-group" key={group.assigneeUserId || 'none'}>
                <div className="board-group-head">
                  <div>
                    <h2>{group.assigneeName}</h2>
                    <p>{group.done}/{group.total} faits · {group.urgent} urgents</p>
                  </div>
                  <span className="board-progress">{group.total ? Math.round((group.done / group.total) * 100) : 0}%</span>
                </div>
                {group.tasks.length === 0 ? (
                  <div className="empty-state compact">Aucun menage sur cette periode.</div>
                ) : (
                  <div className="board-table-wrap">
                    <table className="board-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Logement</th>
                          <th>Depart</th>
                          <th>Statut</th>
                          <th>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.tasks.map((task) => {
                          const d = fromISO(task.date);
                          return (
                            <tr key={`${task.logementId}-${task.date}`} className={task.fait ? 'done-row' : ''}>
                              <td>{DOW[d.getUTCDay()]} {d.getUTCDate()}</td>
                              <td>
                                <strong>{task.logementNom}</strong>
                                <span>{task.proprietaire || 'Proprietaire non renseigne'}</span>
                              </td>
                              <td>{task.checkoutTime || '-'}</td>
                              <td><span className={`badge ${task.fait ? 'valid' : task.urgent ? 'urgent' : 'normal'}`}>{task.fait ? 'Fait' : task.urgent ? 'Urgent' : 'A faire'}</span></td>
                              <td>{task.faitLe ? new Date(task.faitLe).toLocaleDateString('fr-FR') : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
