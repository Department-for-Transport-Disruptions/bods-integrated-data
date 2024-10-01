import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeGtfsDownloader = new Command("invoke-gtfs-downloader")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-downloader-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
