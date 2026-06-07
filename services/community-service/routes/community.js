const express = require("express");
const router = express.Router();

// Community Drinks laden
router.get("/", async (req, res) => {
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

// Community Drink teilen
router.post("/", async (req, res) => {
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

module.exports = router;