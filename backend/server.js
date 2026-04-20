// server.js – Hauptdatei für das Sideboard-Backend mit Benutzerprofilen
// Alle Routen und Logik in einer Datei (einfach gehalten im Studentenstil)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;

// ============================================
// Middleware
// ============================================
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
    credentials: true,
  })
);

// ============================================
// Redis-Client erstellen
// ============================================
let redisClient;

async function initRedis() {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });

  redisClient.on("error", (err) => {
    console.error("Redis Fehler:", err);
  });

  await redisClient.connect();
  console.log("✅ Redis verbunden");
  return redisClient;
}

// ============================================
// MySQL-Verbindungspool erstellen
// ============================================
let db;

async function initDB() {
  let versuche = 0;
  while (versuche < 15) {
    try {
      db = await mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "sideboard123",
        database: process.env.DB_NAME || "sideboard_db",
        waitForConnections: true,
        connectionLimit: 10,
      });
      await db.query("SELECT 1");
      console.log("✅ MySQL verbunden");
      return db;
    } catch (err) {
      versuche++;
      console.log(`⏳ Warte auf MySQL... Versuch ${versuche}/15`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("MySQL nicht erreichbar nach 15 Versuchen");
}

// ============================================
// Session mit Redis-Store einrichten
// ============================================
async function initSession() {
  const store = new RedisStore({ client: redisClient });

  app.use(
    session({
      store: store,
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: false, // Für Entwicklung ohne HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 Woche
        sameSite: "lax",
      },
    })
  );

  console.log("✅ Session mit Redis-Store eingerichtet");
}

let geminiModel;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "dein-google-gemini-api-key-hier") {
    console.warn("⚠️  Kein gültiger GEMINI_API_KEY gesetzt – KI-Feature deaktiviert");
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  console.log("✅ Gemini AI initialisiert");
}

function erstelleCacheKey(text) {
  const hash = crypto.createHash("md5").update(text).digest("hex");
  return `deko:${hash}`;
}

// ============================================
// Hilfsfunktionen (Authentifizierung)
// ============================================
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ fehler: "Nicht eingeloggt" });
  }
  next();
}

// Gibt die richtigen Spalten für Queries zurück je nach Login-Status
function getAuthQueryDetails(req) {
  if (req.session.userId) {
    return { field: "user_id", value: req.session.userId };
  }
  return { field: "session_id", value: req.sessionID };
}

// ============================================
// ROUTEN
// ============================================

function registerRoutes() {

// ---------- Authentifizierung ----------

// 1. Registrieren
app.post("/api/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ fehler: "Bitte alle Felder ausfüllen." });
    }

    // Prüfen, ob E-Mail schon existiert
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ fehler: "Diese E-Mail ist bereits registriert." });
    }

    // Passwort hashen & Speichern
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await db.query(
      "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
      [email, username, passwordHash]
    );

    // Automatisch einloggen
    req.session.userId = result.insertId;
    res.json({ erfolg: true, nachricht: "Registrierung erfolgreich" });
  } catch (err) {
    console.error("Registrierung Fehler:", err);
    res.status(500).json({ fehler: "Fehler bei Registrierung" });
  }
});

// 2. Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ fehler: "Bitte E-Mail und Passwort eingeben." });
    }

    // Benutzer suchen
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ fehler: "Ungültige Anmeldedaten." });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ fehler: "Ungültige Anmeldedaten." });
    }

    const sessionId = req.sessionID;
    
    // Anonyme Daten (vor Login) mit dem nun eingeloggten Konto verknüpfen (Migration)
    // Wenn der User anonym eine Konfiguration gemacht hat, weisen wir sie seiner UserID zu
    await db.query(
      "UPDATE configurations SET user_id = ? WHERE session_id = ? AND user_id IS NULL",
      [user.id, sessionId]
    );
    await db.query(
      "UPDATE cart_items SET user_id = ? WHERE session_id = ? AND user_id IS NULL",
      [user.id, sessionId]
    );

    req.session.userId = user.id;
    res.json({ erfolg: true, nachricht: "Erfolgreich eingeloggt", username: user.username });
  } catch (err) {
    console.error("Login Fehler:", err);
    res.status(500).json({ fehler: "Fehler beim Login" });
  }
});

// 3. Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ erfolg: true, nachricht: "Erfolgreich abgemeldet" });
});

// 4. Profil abrufen
app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.session.userId]);
    if (users.length === 0) return res.status(404).json({ fehler: "Benutzer nicht gefunden" });
    
    res.json({ erfolg: true, profile: users[0] });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Laden des Profils" });
  }
});

// 5. Passwort ändern
app.put("/api/profile/password", requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const [users] = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.session.userId]);
    
    const match = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!match) {
      return res.status(401).json({ fehler: "Altes Passwort ist falsch" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.session.userId]);
    
    res.json({ erfolg: true, nachricht: "Passwort erfolgreich geändert" });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Passwort ändern" });
  }
});

// ---------- Gespeicherte Sideboards ----------

// Alle Sideboards des Nutzers abrufen
app.get("/api/saved-sideboards", requireAuth, async (req, res) => {
  try {
    const [boards] = await db.query("SELECT * FROM saved_sideboards WHERE user_id = ? ORDER BY created_at DESC", [req.session.userId]);
    res.json(boards);
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Laden der Sideboards" });
  }
});

// Aktuelles Sideboard als Favorit speichern
app.post("/api/saved-sideboards", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ fehler: "Name fehlt" });

    // Hole aktuelle Konfiguration
    let { field, value } = getAuthQueryDetails(req);
    const [konfigs] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );

    if (konfigs.length === 0) {
      return res.status(400).json({ fehler: "Keine aktive Konfiguration zum Speichern" });
    }

    const k = konfigs[0];
    await db.query(
      "INSERT INTO saved_sideboards (user_id, name, farbe, groesse, deckel_offen) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId, name, k.farbe, k.groesse, k.deckel_offen]
    );

    res.json({ erfolg: true, nachricht: "Sideboard erfolgreich gespeichert" });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Speichern des Sideboards" });
  }
});

// Gespeichertes Sideboard wieder zur aktuellen Konfiguration machen (Load)
app.post("/api/saved-sideboards/:id/load", requireAuth, async (req, res) => {
  try {
    const [boards] = await db.query("SELECT * FROM saved_sideboards WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
    if (boards.length === 0) return res.status(404).json({ fehler: "Sideboard nicht gefunden" });

    const b = boards[0];
    let { field, value } = getAuthQueryDetails(req);

    // Existiert schon eine aktive Config für diesen User?
    const [vorhandene] = await db.query(`SELECT id FROM configurations WHERE ${field} = ?`, [value]);
    
    if (vorhandene.length > 0) {
      await db.query(
        `UPDATE configurations SET farbe = ?, groesse = ?, deckel_offen = ? WHERE ${field} = ?`,
        [b.farbe, b.groesse, b.deckel_offen, value]
      );
    } else {
      // Wenn user_id, auch session_id mitgeben, damit Constraints stimmen
      await db.query(
        `INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen) VALUES (?, ?, ?, ?, ?)`,
        [req.sessionID, req.session.userId, b.farbe, b.groesse, b.deckel_offen]
      );
    }

    res.json({ erfolg: true, nachricht: "Sideboard erfolgreich geladen" });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

// Löschen
app.delete("/api/saved-sideboards/:id", requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM saved_sideboards WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
    res.json({ erfolg: true, nachricht: "Erfolgreich gelöscht" });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Löschen" });
  }
});


// ---------- Konfiguration ----------

app.get("/api/konfiguration", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    const [reihen] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );

    if (reihen.length > 0) {
      res.json(reihen[0]);
    } else {
      res.json({ farbe: "weiss", groesse: "mittel", deckel_offen: false });
    }
  } catch (err) {
    console.error("Laden der Konfiguration:", err);
    res.status(500).json({ fehler: "Konnte Konfiguration nicht laden" });
  }
});

app.post("/api/konfiguration", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    const { farbe, groesse, deckel_offen } = req.body;

    const [vorhandene] = await db.query(
      `SELECT id FROM configurations WHERE ${field} = ?`,
      [value]
    );

    if (vorhandene.length > 0) {
      await db.query(
        `UPDATE configurations SET farbe = ?, groesse = ?, deckel_offen = ? WHERE ${field} = ?`,
        [farbe, groesse, deckel_offen, value]
      );
    } else {
      await db.query(
        `INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen) VALUES (?, ?, ?, ?, ?)`,
        [req.sessionID, req.session.userId || null, farbe, groesse, deckel_offen]
      );
    }
    res.json({ erfolg: true, nachricht: "Konfiguration gespeichert" });
  } catch (err) {
    console.error("Speichern:", err);
    res.status(500).json({ fehler: "Konnte nicht speichern" });
  }
});

// ---------- Zubehör ----------
app.get("/api/zubehoer", async (req, res) => {
  try {
    const [teile] = await db.query("SELECT * FROM accessories ORDER BY name");
    res.json(teile);
  } catch (err) {
    res.status(500).json({ fehler: "Konnte Zubehör nicht laden" });
  }
});

// ---------- Warenkorb ----------
app.get("/api/warenkorb", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    const [items] = await db.query(
      `SELECT ci.id, ci.menge, a.name, a.preis, a.bild_url 
       FROM cart_items ci 
       JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.${field} = ?`,
      [value]
    );

    // Aktive Sideboard Konfiguration holen
    const [konfigs] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );

    if (konfigs.length > 0) {
      const k = konfigs[0];
      const preis = k.groesse === 'gross' ? 399.00 : (k.groesse === 'mittel' ? 299.00 : 199.00);
      items.unshift({
        id: "sideboard",
        menge: 1,
        name: `Sideboard (Größe: ${k.groesse}, Farbe: ${k.farbe})`,
        preis: preis,
        bild_url: "hero_sideboard.png"
      });
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ fehler: "Konnte Warenkorb nicht laden" });
  }
});

app.post("/api/warenkorb", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    const { accessory_id } = req.body;

    const [vorhanden] = await db.query(
      `SELECT id, menge FROM cart_items WHERE ${field} = ? AND accessory_id = ?`,
      [value, accessory_id]
    );

    if (vorhanden.length > 0) {
      await db.query("UPDATE cart_items SET menge = menge + 1 WHERE id = ?", [vorhanden[0].id]);
    } else {
      await db.query(
        "INSERT INTO cart_items (session_id, user_id, accessory_id, menge) VALUES (?, ?, ?, 1)",
        [req.sessionID, req.session.userId || null, accessory_id]
      );
    }
    res.json({ erfolg: true, nachricht: "Zum Warenkorb hinzugefügt" });
  } catch (err) {
    res.status(500).json({ fehler: "Konnte nicht hinzufügen" });
  }
});

app.delete("/api/warenkorb/:id", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    if (req.params.id === "sideboard") {
      await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
      return res.json({ erfolg: true, nachricht: "Sideboard entfernt" });
    }
    await db.query(`DELETE FROM cart_items WHERE id = ? AND ${field} = ?`, [req.params.id, value]);
    res.json({ erfolg: true, nachricht: "Artikel entfernt" });
  } catch (err) {
    res.status(500).json({ fehler: "Konnte nicht entfernen" });
  }
});

app.delete("/api/warenkorb", async (req, res) => {
  try {
    let { field, value } = getAuthQueryDetails(req);
    await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);
    await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    res.json({ erfolg: true, nachricht: "Warenkorb geleert" });
  } catch (err) {
    res.status(500).json({ fehler: "Konnte Warenkorb nicht leeren" });
  }
});

// ---------- Deko- und Raum-Berater (KI) ----------
app.post("/api/deko-berater", async (req, res) => {
  try {
    if (!geminiModel) {
      return res.status(503).json({ fehler: "KI-Service nicht verfügbar" });
    }

    let { field, value } = getAuthQueryDetails(req);

    const [konfigs] = await db.query(
      `SELECT farbe, groesse, deckel_offen FROM configurations WHERE ${field} = ? LIMIT 1`,
      [value]
    );
    const [warenkorbItems] = await db.query(
      `SELECT a.name FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field} = ?`,
      [value]
    );

    const konfig = konfigs.length > 0 ? konfigs[0] : { farbe: "weiss", groesse: "mittel", deckel_offen: false };
    const deckelStatus = konfig.deckel_offen ? "offen" : "geschlossen";
    const zubehoerListe = warenkorbItems.length > 0 ? warenkorbItems.map((i) => i.name).join(", ") : "kein Zubehör ausgewählt";

    const prompt = `Du bist ein freundlicher Einrichtungsberater. Gib einen kurzen Tipp (max. 2 Sätze) für ein Sideboard in Farbe ${konfig.farbe}, Größe ${konfig.groesse}, der Deckel ist ${deckelStatus}. Folgendes Zubehör ist vorhanden: ${zubehoerListe}. Antworte auf Deutsch und sei kreativ.`;
    const cacheKey = erstelleCacheKey(`${konfig.farbe}-${konfig.groesse}-${deckelStatus}-${zubehoerListe}`);

    const gecached = await redisClient.get(cacheKey);
    if (gecached) {
      return res.json({ tipp: gecached, quelle: "cache" });
    }

    const ergebnis = await geminiModel.generateContent(prompt);
    const antwort = ergebnis.response.text();

    await redisClient.setEx(cacheKey, 3600, antwort);
    res.json({ tipp: antwort, quelle: "gemini" });
  } catch (err) {
    res.status(500).json({ fehler: "KI-Berater konnte keine Antwort generieren" });
  }
});

} // Ende von registerRoutes()

// ============================================
// Server starten
// ============================================
async function start() {
  try {
    await initRedis();
    await initDB();
    await initSession();
    initGemini();
    registerRoutes();

    app.listen(PORT, () => {
      console.log(`\n🚀 Backend läuft auf Port ${PORT} (inklusive Profil-Feature)`);
    });
  } catch (err) {
    console.error("❌ Fehler beim Starten:", err);
    process.exit(1);
  }
}

start();
