const express = require("express");
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ fehler: "Nicht eingeloggt" });
  next();
}

// 1. Alle Reviews für ein Produkt holen
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { product_type, product_id } = req.query; // product_type = 'sideboard' oder 'accessory'
    if (!product_type || !product_id) return res.status(400).json({ fehler: "Produkt nicht spezifiziert" });

    const [rows] = await db.query(
      `SELECT r.*, u.username 
       FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.product_type = ? AND r.product_id = ? 
       ORDER BY r.created_at DESC`,
      [product_type, product_id]
    );
    res.json(rows);
  } catch(err) {
    res.status(500).json({ fehler: "Fehler beim Laden der Bewertungen" });
  }
});

// 2. Neues Review posten
router.post("/", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { product_type, product_id, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ fehler: "Rating muss zwischen 1 und 5 sein" });

    await db.query(
      "INSERT INTO reviews (user_id, product_type, product_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId, product_type, product_id, rating, comment || ""]
    );
    res.json({ erfolg: true });
  } catch(err) {
    res.status(500).json({ fehler: "Konnte Bewertung nicht speichern" });
  }
});

// 3. Eigene Bewertung löschen
router.delete("/:id", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  await db.query("DELETE FROM reviews WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
  res.json({ erfolg: true });
});

module.exports = router;
