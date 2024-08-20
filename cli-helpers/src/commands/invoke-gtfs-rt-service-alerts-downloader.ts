import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeGtfsRtServiceAlertsDownloader = new Command("invoke-gtfs-rt-service-alerts-downloader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-rt-service-alerts-downloader-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
