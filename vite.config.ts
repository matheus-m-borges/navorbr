import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";

export default defineConfig(({ command, mode }) => {
  const isBuild = command === "build";
  const env = loadEnv(mode, process.cwd(), "");

  // Presets suportados: "vercel" (padrão de produção), "cloudflare-module", ou "node-server"
  const nitroPreset = process.env.NITRO_PRESET || env.NITRO_PRESET || "vercel";

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
        "@tanstack/react-router",
      ],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || "https://pursxhdsloixsfkcaprz.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_y4pTa0t349Qi0zHr0Cg9Jw_SQvIkV3a",
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        process.env.VITE_SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID || "pursxhdsloixsfkcaprz",
      ),
    },
    server: {
      host: true,
      port: 8080,
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
      }),
      viteReact(),
      ...(isBuild
        ? [
            nitro({
              preset: nitroPreset,
            }),
          ]
        : []),
    ],
  };
});
