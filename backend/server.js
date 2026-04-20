// server.js – Hauptdatei für das Sideboard-Backend
// Alle Routen und Logik in einer Datei (einfach gehalten)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
const mysql = require("mysql2/promise");
const crypto = require("crypto");
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
  // Warte kurz, damit MySQL wirklich bereit ist
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
      // Teste die Verbindung
      await db.query("SELECT 1");
      console.log("✅ MySQL verbunden");
      return db;
    } catch (err) {
      versuche++;
      console.log(
        `⏳ Warte auf MySQL... Versuch ${versuche}/15`
      );
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
      secret: process.env.SESSION_SECRET || "fallback-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: false, // Für Entwicklung ohne HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 Tag
        sameSite: "lax",
      },
    })
  );

  console.log("✅ Session mit Redis-Store eingerichtet");
}

// ============================================
// Gemini AI initialisieren
// ============================================
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

// ============================================
// Hilfsfunktion: Einfacher Hash für Cache-Schlüssel
// ============================================
function erstelleCacheKey(text) {
  const hash = crypto.createHash("md5").update(text).digest("hex");
  return `deko:${hash}`;
}

// ============================================
// ROUTEN
// ============================================

function registerRoutes() {

// ---------- Konfiguration ----------

// Aktuelle Konfiguration laden
app.get("/api/konfiguration", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const [reihen] = await db.query(
      "SELECT * FROM configurations WHERE session_id = ? ORDER BY aktualisiert_am DESC LIMIT 1",
      [sessionId]
    );

    if (reihen.length > 0) {
      res.json(reihen[0]);
    } else {
      // Standardkonfiguration zurückgeben
      res.json({
        farbe: "weiss",
        groesse: "mittel",
        deckel_offen: false,
      });
    }
  } catch (err) {
    console.error("Fehler beim Laden der Konfiguration:", err);
    res.status(500).json({ fehler: "Konnte Konfiguration nicht laden" });
  }
});

// Konfiguration speichern / aktualisieren
app.post("/api/konfiguration", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { farbe, groesse, deckel_offen } = req.body;

    // Prüfen ob schon eine Konfiguration existiert
    const [vorhandene] = await db.query(
      "SELECT id FROM configurations WHERE session_id = ?",
      [sessionId]
    );

    if (vorhandene.length > 0) {
      // Update
      await db.query(
        `UPDATE configurations 
         SET farbe = ?, groesse = ?, deckel_offen = ? 
         WHERE session_id = ?`,
        [farbe, groesse, deckel_offen, sessionId]
      );
    } else {
      // Neu einfügen
      await db.query(
        `INSERT INTO configurations (session_id, farbe, groesse, deckel_offen) 
         VALUES (?, ?, ?, ?)`,
        [sessionId, farbe, groesse, deckel_offen]
      );
    }

    res.json({ erfolg: true, nachricht: "Konfiguration gespeichert" });
  } catch (err) {
    console.error("Fehler beim Speichern:", err);
    res.status(500).json({ fehler: "Konnte nicht speichern" });
  }
});

// ---------- Zubehör ----------

// Alle Zubehörteile laden
app.get("/api/zubehoer", async (req, res) => {
  try {
    const [teile] = await db.query("SELECT * FROM accessories ORDER BY name");
    res.json(teile);
  } catch (err) {
    console.error("Fehler beim Laden des Zubehörs:", err);
    res.status(500).json({ fehler: "Konnte Zubehör nicht laden" });
  }
});

// ---------- Warenkorb ----------

// Warenkorb anzeigen
app.get("/api/warenkorb", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const [items] = await db.query(
      `SELECT ci.id, ci.menge, a.name, a.preis, a.bild_url 
       FROM cart_items ci 
       JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.session_id = ?`,
      [sessionId]
    );
    res.json(items);
  } catch (err) {
    console.error("Fehler beim Laden des Warenkorbs:", err);
    res.status(500).json({ fehler: "Konnte Warenkorb nicht laden" });
  }
});

// Artikel zum Warenkorb hinzufügen
app.post("/api/warenkorb", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { accessory_id } = req.body;

    // Prüfen ob Artikel schon im Warenkorb
    const [vorhanden] = await db.query(
      "SELECT id, menge FROM cart_items WHERE session_id = ? AND accessory_id = ?",
      [sessionId, accessory_id]
    );

    if (vorhanden.length > 0) {
      // Menge erhöhen
      await db.query(
        "UPDATE cart_items SET menge = menge + 1 WHERE id = ?",
        [vorhanden[0].id]
      );
    } else {
      // Neu einfügen
      await db.query(
        "INSERT INTO cart_items (session_id, accessory_id, menge) VALUES (?, ?, 1)",
        [sessionId, accessory_id]
      );
    }

    res.json({ erfolg: true, nachricht: "Zum Warenkorb hinzugefügt" });
  } catch (err) {
    console.error("Fehler beim Hinzufügen:", err);
    res.status(500).json({ fehler: "Konnte nicht hinzufügen" });
  }
});

// Artikel aus Warenkorb entfernen
app.delete("/api/warenkorb/:id", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    await db.query(
      "DELETE FROM cart_items WHERE id = ? AND session_id = ?",
      [req.params.id, sessionId]
    );
    res.json({ erfolg: true, nachricht: "Artikel entfernt" });
  } catch (err) {
    console.error("Fehler beim Entfernen:", err);
    res.status(500).json({ fehler: "Konnte nicht entfernen" });
  }
});

// Gesamten Warenkorb leeren (für Checkout)
app.delete("/api/warenkorb", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    await db.query(
      "DELETE FROM cart_items WHERE session_id = ?",
      [sessionId]
    );
    res.json({ erfolg: true, nachricht: "Warenkorb geleert" });
  } catch (err) {
    console.error("Fehler beim Leeren des Warenkorbs:", err);
    res.status(500).json({ fehler: "Konnte Warenkorb nicht leeren" });
  }
});

// ---------- Deko- und Raum-Berater (KI) ----------

app.post("/api/deko-berater", async (req, res) => {
  try {
    // Prüfen ob Gemini verfügbar ist
    if (!geminiModel) {
      return res.status(503).json({
        fehler: "KI-Service nicht verfügbar. Bitte GEMINI_API_KEY setzen.",
      });
    }

    const sessionId = req.sessionID;

    // Aktuelle Konfiguration aus DB holen
    const [konfigs] = await db.query(
      "SELECT farbe, groesse, deckel_offen FROM configurations WHERE session_id = ? LIMIT 1",
      [sessionId]
    );

    // Warenkorb-Inhalt holen
    const [warenkorbItems] = await db.query(
      `SELECT a.name FROM cart_items ci 
       JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.session_id = ?`,
      [sessionId]
    );

    // Konfigurationswerte vorbereiten
    const konfig = konfigs.length > 0
      ? konfigs[0]
      : { farbe: "weiss", groesse: "mittel", deckel_offen: false };

    const deckelStatus = konfig.deckel_offen ? "offen" : "geschlossen";
    const zubehoerListe =
      warenkorbItems.length > 0
        ? warenkorbItems.map((i) => i.name).join(", ")
        : "kein Zubehör ausgewählt";

    // Prompt bauen (deutsch, freundlich)
    const prompt = `Du bist ein freundlicher Einrichtungsberater. Gib einen kurzen Tipp (max. 2 Sätze) für ein Sideboard in Farbe ${konfig.farbe}, Größe ${konfig.groesse}, der Deckel ist ${deckelStatus}. Folgendes Zubehör ist vorhanden: ${zubehoerListe}. Antworte auf Deutsch und sei kreativ.`;

    // Cache-Schlüssel erstellen (basierend auf Konfig-Werten)
    const cacheKey = erstelleCacheKey(
      `${konfig.farbe}-${konfig.groesse}-${deckelStatus}-${zubehoerListe}`
    );

    // Zuerst im Cache schauen
    const gecached = await redisClient.get(cacheKey);
    if (gecached) {
      console.log("📦 KI-Antwort aus Cache geladen");
      return res.json({ tipp: gecached, quelle: "cache" });
    }

    // Gemini API aufrufen
    console.log("🤖 Frage Gemini...");
    const ergebnis = await geminiModel.generateContent(prompt);
    const antwort = ergebnis.response.text();

    // In Redis cachen (TTL: 1 Stunde = 3600 Sekunden)
    await redisClient.setEx(cacheKey, 3600, antwort);

    res.json({ tipp: antwort, quelle: "gemini" });
  } catch (err) {
    console.error("Fehler beim Deko-Berater:", err);
    res.status(500).json({
      fehler: "KI-Berater konnte keine Antwort generieren",
    });
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

    // Routen erst NACH Session-Middleware registrieren
    // (Express verarbeitet Middleware in Reihenfolge)
    registerRoutes();

    app.listen(PORT, () => {
      console.log(`\n🚀 Backend läuft auf Port ${PORT}`);
      console.log(`   Endpunkte:`);
      console.log(`   GET  /api/konfiguration`);
      console.log(`   POST /api/konfiguration`);
      console.log(`   GET  /api/zubehoer`);
      console.log(`   GET  /api/warenkorb`);
      console.log(`   POST /api/warenkorb`);
      console.log(`   DELETE /api/warenkorb`);
      console.log(`   DELETE /api/warenkorb/:id`);
      console.log(`   POST /api/deko-berater\n`);
    });
  } catch (err) {
    console.error("❌ Fehler beim Starten:", err);
    process.exit(1);
  }
}

start();
