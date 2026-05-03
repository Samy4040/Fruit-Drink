const express = require("express");
const crypto = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();

let geminiModel;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== "dein-google-gemini-api-key-hier") {
  const genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

router.post("/advice", async (req, res) => {
  const db = req.app.locals.db;
  const redis = req.app.locals.redisClient;
  
  if (!geminiModel) return res.status(503).json({ fehler: "KI nicht konfiguriert" });

  try {
    const { type } = req.body; // 'styling' | 'deco' | 'color'
    let { field, value } = getAuthQueryDetails(req);
    
    const [konfigs] = await db.query(`SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`, [value]);
    const [cartItems] = await db.query(`SELECT a.name FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field} = ?`, [value]);

    const k = konfigs.length > 0 ? konfigs[0] : { farbe: "weiss", groesse: "mittel", material: "Holz", finish: "matt" };
    const zubehoerStr = cartItems.length > 0 ? cartItems.map(i => i.name).join(", ") : "kein Zubehör";

    const promptText = `Du bist ein freundlicher Einrichtungsberater. Ein Benutzer plant ein Sideboard (Farbe: ${k.farbe}, Größe: ${k.groesse}, Material: ${k.material}, Finish: ${k.finish}). Im Warenkorb liegt: ${zubehoerStr}. Art der Beratung: ${type || 'allgemein'}. Gib einen extrem kurzen, kreativen Tipp (max. 1-2 Sätze) auf Deutsch.`;
    const promptHash = crypto.createHash("md5").update(promptText).digest("hex");

    // Check DB Cache (wie im Anforderungsprofil)
    const [cachedOps] = await db.query("SELECT response FROM ai_cache WHERE prompt_hash = ? AND expires_at > NOW()", [promptHash]);
    if (cachedOps.length > 0) {
      return res.json({ advice: cachedOps[0].response, cached: true });
    }

    // Call Gemini
    const ergebnis = await geminiModel.generateContent(promptText);
    const antwort = ergebnis.response.text();

    // In DB cachen (1 Tag TTL)
    await db.query("INSERT INTO ai_cache (prompt_hash, response, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [promptHash, antwort]);
    
    res.json({ advice: antwort, cached: false });
  } catch (err) {
    res.status(500).json({ fehler: "KI Aufruf fehlgeschlagen" });
  }
});

module.exports = router;
