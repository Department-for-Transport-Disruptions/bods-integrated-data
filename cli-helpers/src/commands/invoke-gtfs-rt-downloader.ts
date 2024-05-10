import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeGtfsRtDownloader = new Command("invoke-gtfs-rt-downloader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("--download <download>", "Pass download parameter to function")
    .option("--routeId <routeId>", "Pass routeId parameter to function")
    .option("--startTimeAfter <startTimeAfter>", "Pass startTimeAfter parameter to function")
    .action(async (options) => {
        const { stage, download, routeId, startTimeAfter } = options;

        let invokePayload = {};

        if (download || routeId || startTimeAfter) {
            invokePayload = {
                queryStringParameters: {
                    download,
                    routeId,
                    startTimeAfter,
                },
            };
        }

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-rt-downloader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
