require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
  credentials: true,
}));

async function initRedis() {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });
  redisClient.on("error", (err) => console.error("Redis Fehler:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden");
  app.locals.redisClient = redisClient;
  return redisClient;
}

async function initDB() {
  let versuche = 0;
  while (versuche < 15) {
    try {
      const db = await mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "fruitdrink123",
        database: process.env.DB_NAME || "fruitdrink_db",
        waitForConnections: true,
        connectionLimit: 10,
      });
      await db.query("SELECT 1");
      console.log("✅ MySQL verbunden");
      app.locals.db = db;
      return db;
    } catch (err) {
      versuche++;
      console.log(`⏳ Warte auf MySQL... Versuch ${versuche}/15`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("MySQL nicht erreichbar nach 15 Versuchen");
}

async function initSession(redisClient) {
  const store = new RedisStore({ client: redisClient });
  app.use(session({
    store: store,
    secret: process.env.SESSION_SECRET || "fruitdrink-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
    },
  }));
  console.log("✅ Session eingerichtet");
}

function registerRoutes() {
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/config", require("./routes/config"));
  app.use("/api/shop", require("./routes/shop"));
  app.use("/api/user", require("./routes/user"));
  app.use("/api/ai", require("./routes/ai"));
  app.use("/api/reviews", require("./routes/reviews"));
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
}

async function start() {
  try {
    const redisClient = await initRedis();
    await initDB();
    await initSession(redisClient);
    registerRoutes();
    app.listen(PORT, () => {
      console.log(`\n🚀 Fruit Drink Backend läuft auf Port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Fehler beim Starten:", err);
    process.exit(1);
  }
}

start();