const express = require("express");
const router = express.Router();

// 1. Hole aktuelle Konfiguration
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT * FROM configurations WHERE session_id = ? ORDER BY aktualisiert_am DESC LIMIT 1",
      [req.sessionID]
    );
    if (rows.length > 0) res.json(rows[0]);
    else res.json({ frucht1: "apfel", frucht2: "orange", frucht3: "keine", groesse: "mittel" });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

// 2. Speichere Konfiguration
router.post("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { frucht1, frucht2, frucht3, groesse } = req.body;
    const [existing] = await db.query(
      "SELECT id FROM configurations WHERE session_id = ?",
      [req.sessionID]
    );
    if (existing.length > 0) {
      await db.query(
        "UPDATE configurations SET frucht1=?, frucht2=?, frucht3=?, groesse=? WHERE session_id=?",
        [frucht1, frucht2 || "keine", frucht3 || "keine", groesse, req.sessionID]
      );
    } else {
      await db.query(
        "INSERT INTO configurations (session_id, frucht1, frucht2, frucht3, groesse) VALUES (?, ?, ?, ?, ?)",
        [req.sessionID, frucht1, frucht2 || "keine", frucht3 || "keine", groesse]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Speichern" });
  }
});

// 3. Community Drink teilen
router.post("/community", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { username, name, frucht1, frucht2, frucht3, groesse } = req.body;
    await db.query(
      "INSERT INTO community_drinks (username, name, frucht1, frucht2, frucht3, groesse) VALUES (?, ?, ?, ?, ?, ?)",
      [username || "Anonym", name || "Mein Drink", frucht1, frucht2 || "keine", frucht3 || "keine", groesse || "mittel"]
    );
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Teilen" });
  }
});

// 4. Community Drinks laden
router.get("/community", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT * FROM community_drinks ORDER BY erstellt_am DESC LIMIT 20"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

module.exports = router;