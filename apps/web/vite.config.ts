/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiBase = env.VITE_API_BASE || "http://localhost:3001";

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: { "@": path.resolve(__dirname, "./src") },
        },
        server: {
            host: "0.0.0.0", // allow external access
            port: 5173,
            proxy: {
                "/api": { target: apiBase, changeOrigin: true },
                "/auth": { target: apiBase, changeOrigin: true },
            },
        },
        build: {
            sourcemap: "hidden", // generate sourcemaps for error tracking but do not expose them publicly
        },
        test: {
            environment: "jsdom",
            globals: true,
            setupFiles: ["./src/test/setup.ts"],
        },
    };
});
