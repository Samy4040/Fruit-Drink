require("dotenv").config();
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();
const PORT = process.env.PORT || 3000;

const loadBalancers = {
  konfigurator: process.env.LB_KONFIGURATOR_URL || "http://lb-konfigurator:80",
  shop:         process.env.LB_SHOP_URL         || "http://lb-shop:80",
  community:    process.env.LB_COMMUNITY_URL    || "http://lb-community:80",
};

function proxy(pathPrefix, target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: pathPrefix,
    on: {
      error: (err, req, res) => {
        console.error(`[Gateway] Proxy error → ${target}: ${err.message}`);
        res.status(502).json({ fehler: "Service nicht erreichbar", detail: err.message });
      },
    },
  });
}

app.use(proxy("/api/config",    loadBalancers.konfigurator));
app.use(proxy("/api/shop",      loadBalancers.shop));
app.use(proxy("/api/cart",      loadBalancers.shop));
app.use(proxy("/api/community", loadBalancers.community));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "api-gateway", routes: loadBalancers })
);

app.listen(PORT, () => {
  console.log(`\n🚀 API Gateway running on port ${PORT}`);
  Object.entries(loadBalancers).forEach(([name, url]) =>
    console.log(`   ↳ /api/${name.padEnd(14)} → LB → ${url}`)
  );
});