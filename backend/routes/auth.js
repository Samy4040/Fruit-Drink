const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ fehler: "Nicht eingeloggt" });
  next();
}

// 1. Registrieren
router.post("/register", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { email, username, password, first_name, last_name } = req.body;
    if (!email || !username || !password) return res.status(400).json({ fehler: "Fehlende Felder" });

    const [existing] = await db.query("SELECT id FROM users WHERE email = ? OR username = ?", [email, username]);
    if (existing.length > 0) return res.status(400).json({ fehler: "E-Mail oder Benutzername bereits vergeben" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (email, username, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
      [email, username, hash, first_name || "", last_name || ""]
    );

    req.session.userId = result.insertId;
    res.json({ erfolg: true, nachricht: "Registriert und eingeloggt" });
  } catch (err) {
    res.status(500).json({ fehler: "Registrierungsfehler" });
  }
});

// 2. Login
router.post("/login", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { email, password } = req.body;
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(401).json({ fehler: "Falsche Anmeldedaten" });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ fehler: "Falsche Anmeldedaten" });

    const sessionId = req.sessionID;
    
    // Anonyme Session-Daten auf neuen User migrieren
    await db.query("UPDATE configurations SET user_id = ? WHERE session_id = ? AND user_id IS NULL", [user.id, sessionId]);
    await db.query("UPDATE cart_items SET user_id = ? WHERE session_id = ? AND user_id IS NULL", [user.id, sessionId]);

    req.session.userId = user.id;
    res.json({ erfolg: true, username: user.username });
  } catch (err) {
    res.status(500).json({ fehler: "Login Fehler" });
  }
});

// 3. Logout
router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ erfolg: true });
});

// 4. Me
router.get("/me", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const [users] = await db.query("SELECT id, email, username, first_name, last_name, phone FROM users WHERE id = ?", [req.session.userId]);
  if(users.length === 0) return res.status(404).json({ fehler: "User nicht gefunden" });
  res.json({ profile: users[0] });
});

// 5. Password ändern
router.put("/password", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { oldPassword, newPassword } = req.body;
    const [users] = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.session.userId]);
    const match = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!match) return res.status(401).json({ fehler: "Altes Passwort falsch" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.session.userId]);
    res.json({ erfolg: true, nachricht: "Passwort geändert" });
  } catch(err) {
    res.status(500).json({ fehler: "Passwortfehler" });
  }
});

module.exports = router;
