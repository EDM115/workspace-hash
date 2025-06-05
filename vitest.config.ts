import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: [ "tests/**/*.test.ts" ],
    logHeapUsage: true,
    open: false,
    pool: "threads",
    typecheck: {
      enabled: true,
    },
    watch: false,
  },
})
