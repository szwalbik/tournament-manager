import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const DEFAULT_COLOR = '#ff6a3d';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch('/api/profile/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setFullName(data.full_name || '');
        setTitle(data.title || '');
        setBio(data.bio || '');
        setColor(data.accent_color || DEFAULT_COLOR);
        setFields(data.custom_fields?.length ? data.custom_fields : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const addField = () => {
    if (fields.length >= 8) return;
    setFields(f => [...f, { label: '', value: '' }]);
  };

  const updateField = (idx, key, value) => {
    setFields(f => f.map((field, i) => i === idx ? { ...field, [key]: value } : field));
  };

  const removeField = (idx) => {
    setFields(f => f.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: fullName, title, bio, accent_color: color,
          custom_fields: fields.filter(f => f.label.trim() && f.value.trim())
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setProfile(data);
      setFullName(data.full_name || '');
      setFields(data.custom_fields || []);
      setSuccess('Profil zapisany!');
      refreshUser(); // odśwież navbar i inne miejsca, żeby od razu pokazały nowe imię i nazwisko
    } catch {
      setError('Błąd połączenia');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return (
    <div className="empty-state">
      <div className="empty-icon">🔐</div>
      <h3>Zaloguj się, aby edytować profil</h3>
    </div>
  );

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <div>
      <div className="page-header">
        <h1>🪪 Mój profil</h1>
        <p>Dodaj własny charakter do swojego profilu — tytuł, opis i dowolne pola.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Formularz edycji */}
        <div className="card">
          <div className="section-title">✏️ Edytuj profil</div>
          <div style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>Imię i nazwisko</label>
              <input
                className="input" value={fullName} maxLength={80}
                placeholder="np. Jan Kowalski"
                onChange={e => setFullName(e.target.value)}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                Jeśli podasz imię i nazwisko, będzie ono widoczne w miejscu nicku wszędzie w aplikacji, a Twój nick z Discorda pojawi się mniejszą czcionką pod spodem.
              </span>
            </div>
            <div className="form-group">
              <label>Tytuł / przydomek (np. "Legenda Areny", "Mistrz Serwisu")</label>
              <input
                className="input" value={title} maxLength={60}
                placeholder="Twój tytuł..."
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Opis postaci</label>
              <textarea
                className="input" value={bio} maxLength={500} rows={4}
                placeholder="Opowiedz coś o sobie jako zawodniku/drużynie..."
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                onChange={e => setBio(e.target.value)}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{bio.length}/500</span>
            </div>
            <div className="form-group">
              <label>Kolor motywu profilu</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="color" value={color}
                  onChange={e => setColor(e.target.value)}
                  style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}
                />
                <input
                  className="input" value={color} maxLength={7}
                  onChange={e => setColor(e.target.value)}
                  style={{ maxWidth: 120, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Własne pola (np. "Klan: Czerwoni", "Broń: Forehand loop")</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fields.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input" placeholder="Etykieta" value={f.label} maxLength={30}
                      style={{ flex: '0 0 35%' }}
                      onChange={e => updateField(idx, 'label', e.target.value)}
                    />
                    <input
                      className="input" placeholder="Wartość" value={f.value} maxLength={200}
                      style={{ flex: 1 }}
                      onChange={e => updateField(idx, 'value', e.target.value)}
                    />
                    <button className="btn btn-danger" onClick={() => removeField(idx)}>✕</button>
                  </div>
                ))}
              </div>
              {fields.length < 8 && (
                <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={addField}>
                  + Dodaj pole
                </button>
              )}
            </div>

            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Zapisywanie...' : '💾 Zapisz profil'}
            </button>
          </div>
        </div>

        {/* Podgląd */}
        <div className="card" style={{ borderTop: `3px solid ${color || DEFAULT_COLOR}` }}>
          <div className="section-title">👁️ Podgląd</div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${color || DEFAULT_COLOR}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {fullName.trim() || user.username}
              </div>
              {fullName.trim() && (
                <div style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{user.username}</div>
              )}
              {title && <div style={{ color: color || DEFAULT_COLOR, fontWeight: 600, fontSize: '0.9rem', marginTop: '0.15rem' }}>{title}</div>}
              {user.is_admin && <span className="badge badge-gold" style={{ marginTop: '0.4rem', display: 'inline-block' }}>Administrator</span>}
            </div>
          </div>
          {bio && (
            <p style={{ marginTop: '1rem', color: 'var(--text2)', fontSize: '0.9rem', lineHeight: 1.5 }}>{bio}</p>
          )}
          {fields.filter(f => f.label.trim() && f.value.trim()).length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {fields.filter(f => f.label.trim() && f.value.trim()).map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.4rem 0.6rem', background: 'var(--bg3)', borderRadius: '6px', fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{f.label}</span>
                  <span style={{ textAlign: 'right' }}>{f.value}</span>
                </div>
              ))}
            </div>
          )}
          {!title && !bio && fields.length === 0 && (
            <p style={{ marginTop: '1rem', color: 'var(--text3)', fontSize: '0.85rem' }}>
              Twój profil jest jeszcze pusty — uzupełnij formularz po lewej.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
