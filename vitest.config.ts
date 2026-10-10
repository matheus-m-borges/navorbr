import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  
  // Fallback keys from verified test scripts when .env contains placeholders
  const FALLBACK_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ3B0dGJncXZvZnJ6YWxycmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDUyMTI4OSwiZXhwIjoyMTA2MDk3Mjg5fQ.pZCCwDD66qTIwfHUCfchjBiyY-4jIDf4re0ql1ihPxc";
  const FALLBACK_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ3B0dGJncXZvZnJ6YWxycmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjEyODksImV4cCI6MjEwNjA5NzI4OX0.U4OpiyM1MrX-CYWu_JE3-EdsqkxvELAfLg2CWtny9TU";
  const FALLBACK_URL = "https://rigpttbgqvofrzalrrbq.supabase.co";

  return {
    test: {
      globals: true,
      environment: "node",
      include: ["src/tests/**/*.test.ts"],
      exclude: ["node_modules/**", "dist/**"],
      testTimeout: 30000,
      hookTimeout: 30000,
      env: {
        SUPABASE_URL: env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_URL,
        SUPABASE_SERVICE_ROLE_KEY: (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 20)
          ? env.SUPABASE_SERVICE_ROLE_KEY
          : FALLBACK_SERVICE_ROLE,
        SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || FALLBACK_ANON,
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || FALLBACK_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON,
        VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        VITE_SUPABASE_PROJECT_ID: env.VITE_SUPABASE_PROJECT_ID || "",
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [tsconfigPaths()],
  };
});

