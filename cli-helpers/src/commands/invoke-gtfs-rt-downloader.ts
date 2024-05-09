import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeGtfsRtDownloader = new Command("invoke-gtfs-rt-downloader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("--download", "Pass download parameter to function")
    .action(async (options) => {
        const { stage, download } = options;

        const invokePayload = {
            queryStringParameters: {
                download: download ? "true" : "false",
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-rt-downloader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
