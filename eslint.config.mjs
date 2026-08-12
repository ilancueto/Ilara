import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase local runtime / generated
    "supabase/.temp/**",
    // Mockups and Playwright artifacts (not app source)
    "mockups/**",
    "capturas/**",
    "playwright-report/**",
    "test-results/**",
    "backups/**",
  ]),
]);

export default eslintConfig;
