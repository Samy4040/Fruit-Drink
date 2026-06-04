const express = require("express");
const router = express.Router();

router.get("/accessories", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query("SELECT * FROM accessories WHERE is_active = TRUE ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

router.get("/cart", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [items] = await db.query(
      `SELECT ci.id, ci.menge, a.name, a.preis, a.bild_url 
       FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.session_id = ?`,
      [req.sessionID]
    );
    res.json(items);
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

router.post("/cart", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { accessory_id } = req.body;
    const [vorhanden] = await db.query(
      "SELECT id FROM cart_items WHERE session_id=? AND accessory_id=?",
      [req.sessionID, accessory_id]
    );
    if (vorhanden.length > 0) {
      await db.query("UPDATE cart_items SET menge = menge + 1 WHERE id = ?", [vorhanden[0].id]);
    } else {
      await db.query(
        "INSERT INTO cart_items (session_id, accessory_id, menge) VALUES (?, ?, 1)",
        [req.sessionID, accessory_id]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler" });
  }
});

router.delete("/cart/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    await db.query("DELETE FROM cart_items WHERE id=? AND session_id=?", [req.params.id, req.sessionID]);
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler" });
  }
});

router.delete("/cart", async (req, res) => {
  const db = req.app.locals.db;
  try {
    await db.query("DELETE FROM cart_items WHERE session_id = ?", [req.sessionID]);
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler" });
  }
});

router.post("/checkout", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [cartItems] = await db.query(
      `SELECT ci.menge as quantity, a.name as product_name, a.preis as unit_price
       FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.session_id=?`,
      [req.sessionID]
    );
    if (cartItems.length === 0) {
      return res.status(400).json({ fehler: "Warenkorb leer" });
    }
    const total = cartItems.reduce((acc, item) => acc + (parseFloat(item.unit_price) * item.quantity), 0);
    const { vorname, nachname, email, adresse } = req.body;
    const orderNumber = "FD-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    await db.query(
      "INSERT INTO orders (order_number, vorname, nachname, email, adresse, total_amount) VALUES (?, ?, ?, ?, ?, ?)",
      [orderNumber, vorname, nachname, email, adresse, total]
    );
    await db.query("DELETE FROM cart_items WHERE session_id = ?", [req.sessionID]);
    res.json({ erfolg: true, order_number: orderNumber, total: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ fehler: "Checkout Fehler" });
  }
});
router.patch("/cart/:id/menge", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { delta } = req.body;
    const [items] = await db.query(
      "SELECT id, menge FROM cart_items WHERE id=? AND session_id=?",
      [req.params.id, req.sessionID]
    );
    if (items.length === 0) return res.status(404).json({ fehler: "Nicht gefunden" });
    
    const neueMenge = items[0].menge + delta;
    if (neueMenge <= 0) {
      await db.query("DELETE FROM cart_items WHERE id=?", [req.params.id]);
    } else {
      await db.query("UPDATE cart_items SET menge=? WHERE id=?", [neueMenge, req.params.id]);
    }
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler" });
  }
});
module.exports = router;