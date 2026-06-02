const express = require("express");
const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ status: "KI nicht aktiv" });
});

module.exports = router;