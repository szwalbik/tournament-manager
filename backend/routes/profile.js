const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { scheduleBackup } = require('../services/backup');

const router = express.Router();

const MAX_CUSTOM_FIELDS = 8;
const MAX_LABEL_LEN = 30;
const MAX_VALUE_LEN = 200;
const MAX_BIO_LEN = 500;
const MAX_TITLE_LEN = 60;
const ALLOWED_COLORS = null; // dowolny poprawny hex, walidowany regexem poniżej

function parseCustomFields(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function serializeUserProfile(user) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    is_admin: !!user.is_admin,
    created_at: user.created_at,
    title: user.title || '',
    bio: user.bio || '',
    accent_color: user.accent_color || '',
    custom_fields: parseCustomFields(user.custom_fields),
  };
}

// 👤 Własny profil (pełne dane, do edycji)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!user) return res.status(404).json({ error: 'Nie znaleziono użytkownika' });
    res.json(serializeUserProfile(user));
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ✏️ Aktualizacja własnego profilu — tytuł/opis "postaci" i dowolne pola własne
router.put('/me', requireAuth, async (req, res) => {
  const { title, bio, accent_color, custom_fields } = req.body;
  try {
    if (title !== undefined && String(title).length > MAX_TITLE_LEN) {
      return res.status(400).json({ error: `Tytuł może mieć maks. ${MAX_TITLE_LEN} znaków` });
    }
    if (bio !== undefined && String(bio).length > MAX_BIO_LEN) {
      return res.status(400).json({ error: `Opis może mieć maks. ${MAX_BIO_LEN} znaków` });
    }
    if (accent_color !== undefined && accent_color !== '' && !/^#[0-9a-fA-F]{6}$/.test(accent_color)) {
      return res.status(400).json({ error: 'Kolor musi być w formacie hex, np. #ff6a3d' });
    }

    let cleanFields;
    if (custom_fields !== undefined) {
      if (!Array.isArray(custom_fields)) return res.status(400).json({ error: 'Nieprawidłowy format pól własnych' });
      if (custom_fields.length > MAX_CUSTOM_FIELDS) {
        return res.status(400).json({ error: `Maksymalnie ${MAX_CUSTOM_FIELDS} pól własnych` });
      }
      cleanFields = custom_fields.map(f => ({
        label: String(f.label || '').slice(0, MAX_LABEL_LEN).trim(),
        value: String(f.value || '').slice(0, MAX_VALUE_LEN).trim(),
      })).filter(f => f.label && f.value);
    }

    const current = await db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!current) return res.status(404).json({ error: 'Nie znaleziono użytkownika' });

    await db.run(
      'UPDATE users SET title = ?, bio = ?, accent_color = ?, custom_fields = ? WHERE id = ?',
      [
        title !== undefined ? String(title).trim() : current.title || '',
        bio !== undefined ? String(bio).trim() : current.bio || '',
        accent_color !== undefined ? accent_color : current.accent_color || '',
        cleanFields !== undefined ? JSON.stringify(cleanFields) : current.custom_fields || '[]',
        req.session.user.id,
      ]
    );

    scheduleBackup('auto');
    const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    res.json(serializeUserProfile(updated));
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera: ' + err.message });
  }
});

// 🌍 Publiczny profil dowolnego użytkownika (np. do wyświetlenia przy drużynie/meczu)
router.get('/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Nie znaleziono użytkownika' });
    res.json(serializeUserProfile(user));
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
