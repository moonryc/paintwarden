import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://paintwarden.com",
  integrations: [react()],
  output: "static",
});
