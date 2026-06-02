const express = require("express");
const router = express.Router();

// Einfacher Health-Check - kein Login nötig
router.get("/status", (req, res) => {
  res.json({ eingeloggt: false });
});

module.exports = router;