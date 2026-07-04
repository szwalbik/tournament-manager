# 🏆 TourneyManager — Instrukcja uruchomienia

## Wymagania
- **Node.js** v18 lub nowszy → https://nodejs.org
- Konto Discord Developer (darmowe)

---

## Krok 1 — Skonfiguruj aplikację Discord

1. Wejdź na https://discord.com/developers/applications
2. Kliknij **New Application**, nadaj nazwę (np. "TourneyManager")
3. Przejdź do zakładki **OAuth2**
4. Skopiuj **Client ID** i **Client Secret**
5. W sekcji **Redirects** dodaj: `http://localhost:3001/auth/discord/callback`
6. Zapisz zmiany

### Bot (do powiadomień)
1. Przejdź do zakładki **Bot**
2. Kliknij **Reset Token**, skopiuj token
3. Włącz: **Server Members Intent** (Privileged Gateway Intents)
4. Przejdź do **OAuth2 → URL Generator**, zaznacz: `bot` + uprawnienie `Send Messages`
5. Skopiuj wygenerowany link i dodaj bota do swojego serwera

### Tryb dewelopera w Discord (potrzebny do kopiowania ID)
Discord → Ustawienia → Zaawansowane → **Tryb programisty** ✅

---

## Krok 2 — Konfiguracja backendu

```bash
cd backend
cp .env.example .env
```

Otwórz `.env` i uzupełnij:

```env
DISCORD_CLIENT_ID=          # Client ID z kroku 1
DISCORD_CLIENT_SECRET=      # Client Secret z kroku 1
DISCORD_CALLBACK_URL=http://localhost:3001/auth/discord/callback
DISCORD_BOT_TOKEN=          # Token bota z kroku 1
SESSION_SECRET=             # Dowolny losowy string, np. "abc123xyz789"
FRONTEND_URL=http://localhost:3000
PORT=3001
```

Zainstaluj zależności i uruchom:

```bash
npm install
npm run dev
```

Backend działa na: http://localhost:3001

---

## Krok 3 — Uruchomienie frontendu

W osobnym terminalu:

```bash
cd frontend
npm install
npm start
```

Frontend działa na: http://localhost:3000

---

## Krok 4 — Pierwsze uruchomienie

1. Otwórz http://localhost:3000
2. Kliknij **Zaloguj przez Discord**
3. **Pierwsza osoba, która się zaloguje, automatycznie zostaje administratorem**
4. Przejdź do zakładki **Admin (⚙️)** i skonfiguruj turniej:
   - Wpisz nazwę turnieju
   - Ustaw max. liczbę drużyn
   - Wklej ID kanału Discord do powiadomień

---

## Jak ustawić Channel ID dla powiadomień

1. Włącz tryb dewelopera w Discord (Ustawienia → Zaawansowane)
2. Kliknij prawym przyciskiem na kanał → **Kopiuj ID**
3. Wklej w panelu Admin → pole "Discord Channel ID"
4. Kliknij Zapisz ustawienia

---

## Jak dodać kolejnego administratora

1. Osoba musi się najpierw zalogować na stronie
2. Włącz tryb dewelopera w Discord
3. Kliknij prawym na profil osoby → **Kopiuj ID**
4. W panelu Admin → sekcja "Administratorzy" → wklej ID → Dodaj admina

---

## Przepływ turnieju

```
REJESTRACJA
  ↓ Drużyny rejestrują się na stronie
  ↓ Gracze proszą o dołączenie, kapitan akceptuje
  ↓ Admin klika "Rozpocznij i losuj drabinkę"
AKTYWNY
  ↓ Drabinka wygenerowana, bot wysyła powiadomienie
  ↓ Drużyny grają mecze
  ↓ Obie drużyny zgłaszają wynik na stronie
  ↓ Jeśli wyniki się zgadzają → mecz zatwierdzony
  ↓ Zwycięzca awansuje do następnej rundy
FINAŁ → Zwycięzca turnieju
```

---

## Produkcja (deployment)

Aplikacja jest ustawiona tak, żeby backend serwował zbudowany frontend
(`frontend/dist`) jako statyczne pliki. Dzięki temu wystarczy **jeden
serwis hostingowy** — frontend i backend działają na jednej domenie,
bez problemów z CORS i cookies między różnymi domenami.

### Wdrożenie na Render (darmowy plan) — krok po kroku

1. Wrzuć projekt do repozytorium na GitHubie (bez pliku `.env`!).
2. Wejdź na https://render.com → **New → Web Service** → połącz repo.
3. Ustawienia serwisu:
   - **Root Directory**: `tournament-manager/backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. W sekcji **Environment** dodaj zmienne (te same co w `.env`, ale z
   produkcyjnymi wartościami):
   ```env
   NODE_ENV=production
   PORT=3001
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   DISCORD_BOT_TOKEN=...
   SESSION_SECRET=bardzo-dlugi-losowy-string
   DISCORD_CALLBACK_URL=https://twoja-nazwa.onrender.com/auth/discord/callback
   FRONTEND_URL=https://twoja-nazwa.onrender.com
   ```
   (adres `twoja-nazwa.onrender.com` poznasz dopiero po pierwszym
   wdrożeniu — wtedy wróć i zaktualizuj te dwie zmienne).
5. W panelu Discord Developer → OAuth2 → Redirects dodaj ten sam adres
   co w `DISCORD_CALLBACK_URL`.
6. Kliknij **Deploy**.

### Uwaga: baza danych SQLite

Plik `tournament.db` leży na dysku serwera. Na darmowym planie Render
dysk **nie jest trwały** — dane mogą się wyzerować po restarcie lub
redeployu. Do testów/małego turnieju wystarczy, ale jeśli zależy Ci na
trwałości danych, rozważ:
- płatny "Persistent Disk" na Render, albo
- przejście na hostowaną bazę (np. darmowy plan Postgres na Render/Neon).

Inne polecane platformy dla tego typu aplikacji: **Railway** (podobny
proces wdrożenia), **VPS z PM2 + nginx** (pełna kontrola, dysk trwały).

---

## Struktura projektu

```
tournament-manager/
├── backend/
│   ├── index.js              # Serwer Express + bot Discord
│   ├── discord-client.js     # Singleton klienta Discord
│   ├── .env.example          # Szablon konfiguracji
│   ├── db/
│   │   └── database.js       # SQLite schema i inicjalizacja
│   ├── middleware/
│   │   └── auth.js           # requireAuth, requireAdmin
│   └── routes/
│       ├── auth.js           # Discord OAuth2
│       ├── teams.js          # Drużyny i dołączanie
│       ├── matches.js        # Mecze i wyniki
│       └── admin.js          # Panel admina
├── frontend/
│   └── src/
│       ├── App.js            # Router, NavBar
│       ├── App.css           # Style globalne
│       ├── context/
│       │   └── AuthContext.js
│       └── pages/
│           ├── HomePage.js   # Tabela wyników, aktywne mecze
│           ├── BracketPage.js # Drabinka turniejowa
│           ├── TeamsPage.js   # Zarządzanie drużynami
│           └── AdminPage.js   # Panel admina
└── README.md
```
