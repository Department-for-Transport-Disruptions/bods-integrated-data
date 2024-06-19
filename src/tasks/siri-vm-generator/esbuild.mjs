import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["./index.ts", "./jobs/**/*"],
    bundle: true,
    outdir: "dist",
    platform: "node",
});
