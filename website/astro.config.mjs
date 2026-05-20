import { defineConfig } from "astro/config";

const site = process.env.SITE_URL || process.env.PUBLIC_SITE_URL;

export default defineConfig({
  site: site || undefined,
  output: "static",
  trailingSlash: "ignore",
  server: {
    host: true,
  },
});
