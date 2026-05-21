// @lovable.dev/vite-tanstack-config injects framework defaults.
// We disable the Cloudflare build plugin so `vite build` emits the standard
// Node SSR output at dist/server/server.js, which is what `vite preview`
// (used by the self-hosted Docker image) expects.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
});
