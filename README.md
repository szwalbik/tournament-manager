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

## 💾 Trwałość danych na darmowym hostingu (backup na Discord)

Problem: na darmowych planach (Render, Railway itp.) dysk serwera bywa
**nietrwały** — po usypianiu/restarcie/redeployu plik `tournament.db` może
zostać wyzerowany, a razem z nim wszystkie drużyny, mecze, konta i uprawnienia
administratorów.

Rozwiązanie wbudowane w aplikację: **automatyczny backup na Discord**.

Jak to działa:
1. W panelu Admin → sekcja "💾 Kopie zapasowe na Discordzie" wklej **Channel ID**
   kanału, na który bot ma wysyłać kopie zapasowe (najlepiej osobny, prywatny
   kanał widoczny tylko dla adminów — plik backupu zawiera dane użytkowników).
   Jeśli zostawisz puste, użyty zostanie kanał powiadomień.
2. Po każdej ważnej akcji (rejestracja drużyny, wynik meczu, zmiana ustawień,
   dodanie admina itd.) oraz co 15 minut w tle, aplikacja eksportuje **cały
   stan bazy danych** do pliku JSON i wysyła go jako załącznik na ten kanał.
3. Gdy serwer wystartuje i wykryje **pustą bazę** (czyli świeży/wyzerowany
   dysk po restarcie), automatycznie pobiera najnowszy plik z tego kanału
   i odtwarza wszystkie dane — bez żadnej akcji z Twojej strony.
4. W panelu Admin masz też przyciski **"Backup teraz"** (ręczna kopia) oraz
   **"Przywróć z Discorda"** (ręczne odtworzenie — nadpisuje bieżące dane).

Dzięki temu najgorszy możliwy scenariusz to utrata zmian z ostatnich
kilkunastu minut — a nie całego turnieju.

> Backup wymaga zalogowanego bota Discord (`DISCORD_BOT_TOKEN` w `.env`),
> więc jeśli już korzystasz z powiadomień Discord, nic dodatkowego nie
> musisz konfigurować poza wskazaniem kanału.

### 🏓 Ograniczenie usypiania serwisu (keep-alive)

Dodatkowo, jeśli w zmiennych środowiskowych ustawisz `SELF_URL` (adres, pod
którym działa Twoja aplikacja, np. `https://twoja-nazwa.onrender.com`),
backend będzie co 4 minuty odpytywał sam siebie o `/health`. Na Render ten
adres jest zwykle dostępny automatycznie jako `RENDER_EXTERNAL_URL`, więc
zazwyczaj **nie musisz nic dodatkowo ustawiać** na tej platformie — backend
wykryje go sam. To nie gwarantuje 100% dostępności (darmowe plany mają też
twarde limity godzin miesięcznie), ale znacznie ogranicza częstotliwość
usypiania i restartów.

---

## 🔔 Powiadomienia webhookowe

Oprócz bota Discord (który wymaga tokenu i zaproszenia na serwer), aplikacja
wspiera też prostsze **powiadomienia przez webhook** — przydatne, jeśli
chcesz podpiąć powiadomienia do innego kanału/serwera Discord bez własnego
bota, albo do Slacka, Zapiera, n8n czy własnego serwera.

1. W panelu Admin → pole **"Webhook URL"** wklej:
   - **Discord Webhook** (Ustawienia kanału → Integracje → Webhooki → Nowy
     webhook → Kopiuj URL) — aplikacja sama rozpozna ten format i wyśle
     ładny embed, albo
   - dowolny **inny adres HTTP** — aplikacja wyśle generyczny JSON
     (`{ event, label, data, timestamp }`), który możesz przetworzyć po
     swojej stronie.
2. Kliknij "Zapisz ustawienia", a następnie przycisk **"🔔 Testuj webhook"**,
   żeby sprawdzić, czy wszystko działa.

Webhook jest wywoływany równolegle z powiadomieniami bota przy: rejestracji
drużyny, dołączeniu/wyrzuceniu gracza, starcie turnieju, zgłoszeniu i
zatwierdzeniu wyniku, dodaniu administratora, zmianie ustawień oraz backupie.

---

## 🪪 Profil użytkownika ("w charakterze")

Każdy zalogowany użytkownik ma teraz zakładkę **"🪪 Profil"**, gdzie może
dodać własny charakter do swojego konta:
- **Tytuł/przydomek** (np. "Legenda Areny", "Mistrz Serwisu"),
- **Opis postaci** (dowolny tekst, do 500 znaków),
- **Kolor motywu** (podświetla nazwę użytkownika w pasku nawigacji),
- **Dowolne własne pola** (do 8 par etykieta–wartość, np. "Klan: Czerwoni",
  "Broń: Forehand loop") — mini "karta postaci" dla graczy, którzy chcą
  dodać coś więcej niż tylko nazwę z Discorda.

Dane profilu są częścią bazy danych, więc są też objęte systemem kopii
zapasowych opisanym wyżej.

---

## 📜 Dziennik aktywności (Audit Log)

Panel Admin zawiera teraz sekcję **"📜 Dziennik aktywności"**, pokazującą
ostatnie ważne akcje w systemie: kto i kiedy dodał/usunął administratora,
zresetował turniej, usunął drużynę, rozpoczął turniej, zmienił ustawienia
itd. Ułatwia to rozliczanie się z decyzji, gdy adminów jest kilku.

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
redeployu.

**To ryzyko jest już zaadresowane** przez wbudowany system automatycznego
backupu na Discord — patrz sekcja [💾 Trwałość danych na darmowym
hostingu](#-trwałość-danych-na-darmowym-hostingu-backup-na-discord) wyżej.
W skrócie: skonfiguruj kanał backupu w panelu Admina, a aplikacja sama
zadba o to, żeby żaden restart nie skasował Ci turnieju.

Jeśli mimo to wolisz podejście "klasyczne" (trwały dysk zamiast backupu na
Discord), nadal możesz rozważyć:
- płatny "Persistent Disk" na Render, albo
- przejście na hostowaną bazę (np. darmowy plan Postgres na Render/Neon).

Inne polecane platformy dla tego typu aplikacji: **Railway** (podobny
proces wdrożenia), **VPS z PM2 + nginx** (pełna kontrola, dysk trwały).

---

## Struktura projektu

```
tournament-manager/
├── backend/
│   ├── index.js              # Serwer Express + bot Discord + keep-alive/shutdown
│   ├── discord-client.js     # Singleton klienta Discord (embed, pliki, backup)
│   ├── .env.example          # Szablon konfiguracji
│   ├── db/
│   │   └── database.js       # SQLite schema, migracje i inicjalizacja
│   ├── middleware/
│   │   └── auth.js           # requireAuth, requireAdmin
│   ├── services/
│   │   ├── backup.js         # Eksport/import + backup-restore na Discord
│   │   ├── webhook.js        # Generyczne powiadomienia webhookowe
│   │   └── audit.js          # Dziennik aktywności (audit log)
│   └── routes/
│       ├── auth.js           # Discord OAuth2
│       ├── teams.js          # Drużyny i dołączanie
│       ├── matches.js        # Mecze i wyniki
│       ├── admin.js          # Panel admina, backup, webhook, audit log
│       ├── public.js         # Publiczne ustawienia turnieju
│       └── profile.js        # Profil użytkownika ("w charakterze")
├── frontend/
│   └── src/
│       ├── App.jsx            # Router, NavBar
│       ├── App.css            # Style globalne
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── TournamentContext.jsx
│       └── pages/
│           ├── HomePage.jsx   # Tabela wyników, aktywne mecze
│           ├── BracketPage.jsx # Drabinka turniejowa
│           ├── TeamsPage.jsx   # Zarządzanie drużynami
│           ├── AdminPage.jsx   # Panel admina (+ backup, webhook, audit log)
│           └── ProfilePage.jsx # Profil użytkownika
└── README.md
```
