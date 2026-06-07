require("dotenv").config();
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { createPool } = require("./db/mysql");
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

async function start() {
  const db = await createPool();
  app.locals.db = db;

  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });
  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden (community-service)");

  app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "fruitdrink-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
  }));

  app.use("/api/community", require("./routes/community"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "community-service" }));

  app.listen(PORT, () => console.log(`\n👥 Community Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ community-service failed to start:", err);
  process.exit(1);
});