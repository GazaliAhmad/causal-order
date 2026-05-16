import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  server: {
    host: true,
  },
});
