import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Front servido em 5173; fala com a API em http://localhost:4000 (ver src/lib/api.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
