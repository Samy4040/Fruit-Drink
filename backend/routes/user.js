const express = require("express");
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ fehler: "Nicht eingeloggt" });
  next();
}

router.use(requireAuth);

// 1. Adressen abrufen
router.get("/addresses", async (req, res) => {
  const db = req.app.locals.db;
  const [rows] = await db.query("SELECT * FROM addresses WHERE user_id = ?", [req.session.userId]);
  res.json(rows);
});

// 2. Adresse hinzufügen
router.post("/addresses", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { address_line1, address_line2, city, postal_code, country, is_default } = req.body;
    
    // Wenn is_default, alle anderen zurücksetzen
    if (is_default) {
      await db.query("UPDATE addresses SET is_default = FALSE WHERE user_id = ?", [req.session.userId]);
    }

    await db.query(
      "INSERT INTO addresses (user_id, address_line1, address_line2, city, postal_code, country, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.session.userId, address_line1, address_line2 || '', city, postal_code, country || 'Deutschland', is_default || false]
    );
    res.json({ erfolg: true });
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Speichern der Adresse" });
  }
});

// 3. Adresse löschen
router.delete("/addresses/:id", async (req, res) => {
  const db = req.app.locals.db;
  await db.query("DELETE FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
  res.json({ erfolg: true });
});

// 4. Profil Aktualisieren
router.put("/profile", async (req, res) => {
    const db = req.app.locals.db;
    try {
      const { first_name, last_name, phone } = req.body;
      await db.query("UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?", 
        [first_name, last_name, phone, req.session.userId]);
      res.json({ erfolg: true });
    } catch(err) { res.status(500).json({ fehler: "Profil-Update Fehler" }); }
});

module.exports = router;
