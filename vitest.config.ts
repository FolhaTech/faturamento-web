import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, __dirname, ""));

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      // Todos os arquivos de teste compartilham o mesmo banco Postgres remoto (Supabase) —
      // resetDbForTests() faz TRUNCATE, então rodar arquivos em paralelo causa condição de
      // corrida entre eles. Precisa ser sequencial.
      fileParallelism: false,
    },
  };
});
