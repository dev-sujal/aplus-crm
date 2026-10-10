import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("http://localhost:5000/api/v1") },
  test: { environment: "jsdom", include: ["ui-tests/**/*.test.tsx"], testTimeout: 60000, hookTimeout: 60000, setupFiles: ["ui-tests/setup.ts"] },
})
