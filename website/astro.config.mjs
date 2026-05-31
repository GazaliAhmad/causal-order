import { defineConfig } from "astro/config";

const site =
  process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://causal-order.gazali.one";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "ignore",
  server: {
    host: true,
  },
});
