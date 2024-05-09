import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeGtfsTimetablesGenerator = new Command("invoke-gtfs-timetables-generator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("-r, --region <region>", "Region to generate GTFS for")
    .action(async (options) => {
        const { stage, region = null } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-timetables-generator-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({
                regionCode: region,
            }),
        });
    });
