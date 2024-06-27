import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import * as path from "node:path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: "html",
    use: {
        trace: "on-first-retry",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },

        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },
        //
        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },
    ],
});
