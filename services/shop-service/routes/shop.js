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

module.exports = router;