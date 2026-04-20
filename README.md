# 🪑 Sideboard-Konfigurator

Cloud-native Webanwendung zum Konfigurieren eines Sideboards mit integriertem Deko- und Raum-Berater (Google Gemini KI).

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend   | HTML, CSS, JavaScript (Vanilla) |
| Backend    | Node.js + Express |
| Datenbank  | MySQL 8.0 |
| Cache      | Redis 7 |
| KI         | Google Gemini (gemini-1.5-flash) |
| Container  | Docker + Docker Compose |

## Projektstruktur

```
project/
├── frontend/
│   ├── Dockerfile          # Nginx-Container
│   ├── nginx.conf          # Reverse-Proxy-Konfig
│   └── index.html          # Komplettes Frontend (HTML + CSS + JS)
├── backend/
│   ├── Dockerfile          # Node.js-Container
│   ├── package.json        # Dependencies
│   ├── server.js           # Alle Routen und Logik
│   ├── init.sql            # Datenbank-Schema + Beispieldaten
│   └── .env.example        # Umgebungsvariablen-Vorlage
├── docker-compose.yml      # Alle Services
├── .env.example            # Projekt-weite Umgebungsvariablen
└── README.md
```

## Schnellstart

### 1. Repository klonen und `.env` erstellen

```bash
cp .env.example .env
```

### 2. Gemini API Key eintragen

Bearbeite die `.env` Datei und trage deinen [Google Gemini API Key](https://aistudio.google.com/app/apikey) ein:

```
GEMINI_API_KEY=dein-echter-api-key
```

### 3. Starten mit Docker Compose

```bash
docker-compose up --build
```

### 4. Im Browser öffnen

- **Frontend:** [http://localhost:8080](http://localhost:8080)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

## Features

### ⚙️ Sideboard-Konfigurator
- **Farbe:** Weiß, Schwarz, Eiche
- **Größe:** Klein, Mittel, Groß
- **Deckel:** Auf-/Zuklappen mit CSS-Animation
- Live-Vorschau im Browser
- Speicherung in MySQL pro Session

### 🛍️ Zubehör-Shop
- Zubehörliste aus MySQL (Name, Preis, Bild)
- Warenkorb (Session-basiert)
- Mengenerhöhung bei Doppelklick

### 🤖 KI Deko-Berater
- Sendet aktuelle Konfiguration + Warenkorb an Google Gemini
- Personalisierter Einrichtungstipp (deutsch, max. 2 Sätze)
- Antworten werden in Redis gecacht (TTL: 1 Stunde)

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET     | `/api/konfiguration` | Aktuelle Konfiguration laden |
| POST    | `/api/konfiguration` | Konfiguration speichern |
| GET     | `/api/zubehoer` | Alle Zubehörteile laden |
| GET     | `/api/warenkorb` | Warenkorb anzeigen |
| POST    | `/api/warenkorb` | Artikel zum Warenkorb hinzufügen |
| DELETE  | `/api/warenkorb/:id` | Artikel aus Warenkorb entfernen |
| POST    | `/api/deko-berater` | KI-Tipp anfordern |

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `MYSQL_ROOT_PASSWORD` | MySQL Root-Passwort | `sideboard123` |
| `SESSION_SECRET` | Session-Geheimnis | `mein-geheimes-session-secret` |
| `GEMINI_API_KEY` | Google Gemini API Key | – (erforderlich für KI) |

## Datenbank-Schema

- **configurations** – Gespeicherte Sideboard-Konfigurationen (Farbe, Größe, Deckel)
- **accessories** – Verfügbare Zubehörartikel (Name, Preis, Bild)
- **cart_items** – Warenkorb-Einträge pro Session

## Team

Cloud Web Projekt – HFT Stuttgart, Sommersemester 2026
