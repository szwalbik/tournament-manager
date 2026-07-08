import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';

export default function AdminPage() {
  const { user } = useAuth();
  const { refresh: refreshTournament } = useTournament();
  const [settings, setSettings] = useState({});
  const [status, setStatus] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newAdminId, setNewAdminId] = useState('');
  const [form, setForm] = useState({ max_teams: '', tournament_name: '', discord_channel_id: '', mode: 'teams', webhook_url: '', backup_channel_id: '', auto_backup_enabled: true });
  const [expandedUser, setExpandedUser] = useState(null);
  const [backupStatus, setBackupStatus] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);

  const fetchData = () => {
    Promise.all([
      fetch('/api/admin/settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/teams', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/backup/status', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/audit-log', { credentials: 'include' }).then(r => r.json()).catch(() => []),
    ]).then(([settingsData, usersData, teamsData, backupStatusData, auditLogData]) => {
      const settingsMap = {};
      settingsData.settings?.forEach(s => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);
      setStatus(settingsData.status || {});
      setAdminUsers(settingsData.adminUsers || []);
      setAllUsers(usersData);
      setTeams(teamsData);
      setForm({
        max_teams: settingsMap.max_teams || '8',
        tournament_name: settingsMap.tournament_name || '',
        discord_channel_id: settingsMap.discord_channel_id || '',
        mode: settingsMap.mode === 'solo' ? 'solo' : 'teams',
        webhook_url: settingsMap.webhook_url || '',
        backup_channel_id: settingsMap.backup_channel_id || '',
        auto_backup_enabled: settingsMap.auto_backup_enabled !== '0',
      });
      setBackupStatus(backupStatusData || {});
      setAuditLogs(Array.isArray(auditLogData) ? auditLogData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const saveSettings = async () => {
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form)
    });
    if (res.ok) { setSuccess('Ustawienia zapisane!'); fetchData(); refreshTournament(); }
    else { const d = await res.json(); setError(d.error); }
  };

  const startTournament = async () => {
    if (!window.confirm('Czy na pewno chcesz rozpocząć turniej? Losowanie zostanie wykonane teraz.')) return;
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/start', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) { setSuccess('Turniej rozpoczęty! Drabinka wygenerowana.'); fetchData(); refreshTournament(); }
    else setError(data.error);
  };

  const loadDemo = async () => {
    if (!window.confirm("DEMO: Usunie wszystkie dane i załaduje 8 przykładowych drużyn z gotową drabinką. Kontynuować?")) return;
    setError(""); setSuccess("");
    const res = await fetch("/api/admin/demo", { method: "POST", credentials: "include" });
    const data = await res.json();
    if (res.ok) { setSuccess(`Demo załadowane! ${data.teams} drużyn, ${data.rounds} rund.`); fetchData(); refreshTournament(); }
    else setError(data.error);
  };

  const resetTournament = async () => {
    if (!window.confirm('UWAGA: To usunie wszystkie drużyny, mecze i wyniki. Czy kontynuować?')) return;
    const res = await fetch('/api/admin/reset', { method: 'POST', credentials: 'include' });
    if (res.ok) { setSuccess('Turniej zresetowany.'); fetchData(); refreshTournament(); }
  };

  const addAdmin = async () => {
    if (!newAdminId.trim()) return;
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: newAdminId.trim() })
    });
    const data = await res.json();
    if (res.ok) { setSuccess(`Dodano admina: ${data.username}`); setNewAdminId(''); fetchData(); }
    else setError(data.error);
  };

  const removeAdmin = async (userId) => {
    const res = await fetch(`/api/admin/admins/${userId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) fetchData();
    else { const d = await res.json(); setError(d.error); }
  };

  const runBackupNow = async () => {
    setError(''); setSuccess(''); setBackupBusy(true);
    try {
      const res = await fetch('/api/admin/backup/run', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) { setSuccess('Kopia zapasowa wysłana na Discord! 💾'); fetchData(); }
      else setError(data.error);
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!window.confirm('UWAGA: To NADPISZE obecne dane danymi z ostatniej kopii zapasowej na Discordzie. Kontynuować?')) return;
    setError(''); setSuccess(''); setBackupBusy(true);
    try {
      const res = await fetch('/api/admin/backup/restore', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) { setSuccess('Dane przywrócone z Discorda! Odśwież stronę, aby zobaczyć zmiany.'); fetchData(); }
      else setError(data.error);
    } finally {
      setBackupBusy(false);
    }
  };

  const testWebhook = async () => {
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/webhook/test', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) setSuccess('Testowe powiadomienie wysłane! Sprawdź webhook.');
    else setError(data.error);
  };

  const kickFromTeam = async (teamId, userId, username) => {
    if (!window.confirm(`Wyrzucić ${username} z drużyny?`)) return;
    setError(''); setSuccess('');
    const res = await fetch(`/api/teams/${teamId}/members/${userId}/kick`, {
      method: 'POST', credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) { setSuccess(`Wyrzucono ${username}.`); fetchData(); }
    else setError(data.error);
  };

  const deleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Usunąć drużynę "${teamName}"?`)) return;
    setError(''); setSuccess('');
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { setSuccess(`Usunięto drużynę ${teamName}.`); fetchData(); }
    else { const d = await res.json(); setError(d.error); }
  };

  // Znajdź drużynę danego użytkownika
  const getUserTeam = (userId) => {
    return teams.find(t =>
      t.members?.some(m => m.id === userId && m.status === 'accepted')
    );
  };

  if (!user) return (
    <div className="empty-state">
      <div className="empty-icon">🔐</div>
      <h3>Zaloguj się, aby uzyskać dostęp</h3>
    </div>
  );

  if (!user.is_admin) return (
    <div className="empty-state">
      <div className="empty-icon">🚫</div>
      <h3>Brak uprawnień administratora</h3>
      <p>Tylko administratorzy mogą uzyskać dostęp do tego panelu</p>
    </div>
  );

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  const phaseLabel = { registration: '📝 Rejestracja', active: '⚔️ Aktywny', finished: '🏁 Zakończony' };

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Panel Administratora</h1>
        <p>Zarządzaj turniejem i uprawnieniami</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="status-bar" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600 }}>Status turnieju:</div>
        <span className="badge badge-blue">{phaseLabel[status.phase] || status.phase}</span>
        {status.started_at && (
          <span style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
            Rozpoczęty: {new Date(status.started_at).toLocaleString('pl-PL')}
          </span>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Settings */}
        <div className="card">
          <div className="section-title">⚙️ Ustawienia turnieju</div>
          <div style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>Nazwa turnieju</label>
              <input className="input" value={form.tournament_name}
                onChange={e => setForm(f => ({ ...f, tournament_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Tryb turnieju</label>
              <select
                className="input"
                value={form.mode}
                disabled={status.phase !== 'registration'}
                onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
              >
                <option value="teams">👥 Drużynowy</option>
                <option value="solo">🏓 Solo (1 na 1)</option>
              </select>
              {status.phase !== 'registration' ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Niedostępne po starcie turnieju</span>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                  W trybie solo gracze zapisują się indywidualnie, bez tworzenia drużyn.
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Maksymalna liczba {form.mode === 'solo' ? 'zawodników' : 'drużyn'}</label>
              <input className="input" type="number" min="2" max="64" value={form.max_teams}
                onChange={e => setForm(f => ({ ...f, max_teams: e.target.value }))}
                disabled={status.phase !== 'registration'} />
              {status.phase !== 'registration' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Niedostępne po starcie turnieju</span>
              )}
            </div>
            <div className="form-group">
              <label>Discord Channel ID (powiadomienia)</label>
              <input className="input" value={form.discord_channel_id} placeholder="np. 1234567890123456789"
                onChange={e => setForm(f => ({ ...f, discord_channel_id: e.target.value }))} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                Kliknij prawym na kanał → Kopiuj ID (włącz tryb dewelopera w DC)
              </span>
            </div>
            <div className="form-group">
              <label>Webhook URL (dodatkowe powiadomienia)</label>
              <input className="input" value={form.webhook_url} placeholder="np. https://discord.com/api/webhooks/..."
                onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                Discord Webhook lub dowolny endpoint HTTP (Slack, Zapier, n8n, własny serwer...)
              </span>
            </div>
            <button className="btn btn-primary" onClick={saveSettings}>💾 Zapisz ustawienia</button>
          </div>
        </div>

        {/* Tournament control */}
        <div className="card">
          <div className="section-title">🏆 Sterowanie turniejem</div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Rozpocznij turniej</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Losowo dobierze drużyny i wygeneruje drabinkę pucharową.
              </div>
              <button className="btn btn-gold" onClick={startTournament} disabled={status.phase !== 'registration'}>
                ▶ Rozpocznij i losuj drabinkę
              </button>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(248,113,113,0.2)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--red)' }}>Reset turnieju</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Usuwa wszystkie drużyny, mecze i wyniki.
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button className="btn btn-danger" onClick={resetTournament}>🗑 Resetuj wszystko</button>
              <button className="btn" style={{ background: "var(--bg2)", border: "1px solid #7c85a0", color: "var(--text2)" }} onClick={loadDemo}>🎮 Załaduj DEMO</button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* 💾 Kopie zapasowe — ochrona przed utratą danych na darmowym hostingu */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">💾 Kopie zapasowe na Discordzie</div>
        <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Darmowy hosting (np. Render) potrafi wyzerować dysk po restarcie serwisu. Żeby temu zapobiec,
          cały stan turnieju (użytkownicy, drużyny, mecze, ustawienia) jest automatycznie wysyłany jako
          plik na wskazany kanał Discord — a przy starcie serwera, jeśli baza jest pusta, aplikacja
          sama odtwarza ostatnią kopię. Nie musisz nic robić ręcznie, ale poniżej masz też pełną kontrolę.
        </p>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Discord Channel ID dla kopii zapasowych (opcjonalnie)</label>
          <input className="input" value={form.backup_channel_id} placeholder="puste = użyje kanału powiadomień"
            onChange={e => setForm(f => ({ ...f, backup_channel_id: e.target.value }))} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
            Zalecany osobny, prywatny kanał widoczny tylko dla adminów — pliki backupu zawierają dane użytkowników.
          </span>
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.6rem' }}>
          <input
            type="checkbox" id="auto_backup" checked={form.auto_backup_enabled}
            onChange={e => setForm(f => ({ ...f, auto_backup_enabled: e.target.checked }))}
            style={{ width: 'auto' }}
          />
          <label htmlFor="auto_backup" style={{ marginBottom: 0 }}>Automatyczny backup włączony (po ważnych akcjach + co 15 min)</label>
        </div>
        <button className="btn btn-primary" onClick={saveSettings} style={{ marginBottom: '1rem' }}>💾 Zapisz ustawienia backupu</button>

        <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>
            <div>Ostatni backup: <strong style={{ color: 'var(--text)' }}>{backupStatus.last_backup_at ? new Date(backupStatus.last_backup_at).toLocaleString('pl-PL') : 'nigdy'}</strong></div>
            <div>Ostatnie przywrócenie: <strong style={{ color: 'var(--text)' }}>{backupStatus.last_restore_at ? new Date(backupStatus.last_restore_at).toLocaleString('pl-PL') : 'nigdy'}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={runBackupNow} disabled={backupBusy}>💾 Backup teraz</button>
            <button className="btn btn-danger" onClick={restoreBackup} disabled={backupBusy}>♻️ Przywróć z Discorda</button>
            <button className="btn btn-ghost" onClick={testWebhook}>🔔 Testuj webhook</button>
          </div>
        </div>
      </div>

      {/* 📜 Dziennik aktywności */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">📜 Dziennik aktywności ({auditLogs.length})</div>
        <div className="table-wrap" style={{ marginTop: '0.75rem', maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Kiedy</th>
                <th>Kto</th>
                <th>Akcja</th>
                <th>Szczegóły</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr><td colSpan={4} style={{ color: 'var(--text3)', padding: '0.75rem' }}>Brak zdarzeń</td></tr>
              )}
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('pl-PL')}
                  </td>
                  <td style={{ fontWeight: 500 }}>{log.actor_username || 'System'}</td>
                  <td><span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{log.action}</span></td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin management */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">👑 Administratorzy</div>
        <div style={{ marginTop: '0.75rem' }}>
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <input
              className="input"
              placeholder="Discord User ID (np. 123456789012345678)"
              value={newAdminId}
              onChange={e => setNewAdminId(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addAdmin}>Dodaj admina</button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '1rem' }}>
            Kliknij prawym na użytkownika w DC → Kopiuj ID (wymagany tryb dewelopera). Użytkownik musi się najpierw zalogować.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {adminUsers.map(admin => (
              <div key={admin.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem', background: 'var(--bg3)', borderRadius: '8px'
              }}>
                <img
                  src={admin.avatar ? `https://cdn.discordapp.com/avatars/${admin.id}/${admin.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                  alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                />
                <span style={{ flex: 1, fontWeight: 500 }}>{admin.username}</span>
                <span style={{ color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{admin.id}</span>
                {admin.id !== user.id
                  ? <button className="btn btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => removeAdmin(admin.id)}>Usuń</button>
                  : <span className="badge badge-gold">Ty</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teams management */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">🏆 Zarządzanie {form.mode === 'solo' ? 'zawodnikami' : 'drużynami'} ({teams.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          {teams.length === 0 && (
            <p style={{ color: 'var(--text2)', padding: '0.5rem 0' }}>Brak drużyn</p>
          )}
          {teams.map(team => {
            const accepted = team.members?.filter(m => m.status === 'accepted') || [];
            const isOpen = expandedUser === `team-${team.id}`;
            return (
              <div key={team.id} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '8px', overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{team.name}</span>
                    <span style={{ color: 'var(--text2)', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
                      Kapitan: {team.rep_username} · {accepted.length} graczy
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => setExpandedUser(isOpen ? null : `team-${team.id}`)}
                  >
                    {isOpen ? '▲ Zwiń' : '▼ Skład'}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => deleteTeam(team.id, team.name)}
                  >
                    🗑 Usuń drużynę
                  </button>
                </div>
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {accepted.map(member => (
                        <div key={member.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.4rem 0.5rem', background: 'var(--bg2)', borderRadius: '6px'
                        }}>
                          <img
                            src={member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                            alt="" style={{ width: 26, height: 26, borderRadius: '50%' }}
                          />
                          <span style={{ flex: 1, fontWeight: member.id === team.representative_id ? 600 : 400 }}>
                            {member.username}
                          </span>
                          <span style={{ color: 'var(--text3)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                            {member.id}
                          </span>
                          {member.id === team.representative_id
                            ? <span className="badge badge-gold">Kapitan</span>
                            : <button
                                className="btn btn-danger"
                                style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => kickFromTeam(team.id, member.id, member.username)}
                              >
                                Wyrzuć
                              </button>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* All users */}
      <div className="card">
        <div className="section-title">👤 Wszyscy użytkownicy ({allUsers.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Użytkownik</th>
                <th>Discord ID</th>
                <th>Drużyna</th>
                <th>Rola</th>
                <th>Dołączył</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(u => {
                const userTeam = getUserTeam(u.id);
                const isRep = userTeam?.representative_id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <img
                          src={u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                          alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                        />
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.username}</div>
                          {u.is_admin && <div style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>Administrator</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text3)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{u.id}</td>
                    <td>
                      {userTeam
                        ? <div>
                            <span style={{ fontWeight: 600 }}>{userTeam.name}</span>
                            {isRep && <span className="badge badge-gold" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>Kapitan</span>}
                          </div>
                        : <span style={{ color: 'var(--text3)' }}>—</span>
                      }
                    </td>
                    <td>
                      {u.is_admin
                        ? <span className="badge badge-gold">Admin</span>
                        : <span className="badge badge-gray">Użytkownik</span>
                      }
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString('pl-PL')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
