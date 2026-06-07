require("dotenv").config();
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { createPool } = require("./db/mysql");
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

async function start() {
  const db = await createPool(PORT);
  app.locals.db = db;

  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });
  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden (shop-service)");

  app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "fruitdrink-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
  }));

  app.use("/api/shop", require("./routes/shop"));
  app.use("/api/cart", require("./routes/cart"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "shop-service" }));

  app.listen(PORT, () => console.log(`\n🛍️ Shop Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ shop-service failed to start:", err);
  process.exit(1);
});