import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeGtfsDownloader = new Command("invoke-gtfs-downloader")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = options;

        const response = await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-downloader-${stage}`,
            InvocationType: "RequestResponse",
        });

        const payload = response?.Payload?.transformToString();

        console.log("Response", JSON.stringify(JSON.parse(payload!), null, 2));
    });
