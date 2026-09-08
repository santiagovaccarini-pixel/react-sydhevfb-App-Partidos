import { defineConfig, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    {
      name: "app-js-como-jsx",
      enforce: "pre",
      async transform(codigo, id) {
        if (!/\/src\/.*\.js$/.test(id)) return null;
        return transformWithOxc(codigo, id, { lang: "jsx" });
      },
    },
    react(),
  ],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "@supabase/supabase-js"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: true,
  },
});
