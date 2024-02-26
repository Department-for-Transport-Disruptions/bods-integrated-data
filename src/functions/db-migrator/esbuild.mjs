import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["./index.ts", "./migrations/*"],
    bundle: true,
    outdir: "dist",
    platform: "node",
});
