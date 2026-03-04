import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            // Proximar llamadas al BFF para evitar CORS durante desarrollo
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
            // Proximar WebSockets
            "/ws": {
                target: "ws://localhost:8000",
                ws: true,
            },
        },
    },
});
