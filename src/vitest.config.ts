import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["**/*.{test,spec}.{js,ts}"],
        environment: "node",
        coverage: {
            enabled: true,
            provider: "v8",
            include: ["**/*.ts"],
            exclude: ["**/esbuild.mjs", "**/functions/db-migrator/migrations/*", "**/coverage/**"],
        },
    },
});
