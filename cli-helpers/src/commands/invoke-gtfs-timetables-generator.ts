import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeGtfsTimetablesGenerator = new Command("invoke-gtfs-timetables-generator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-timetables-generator-${stage}`,
            InvocationType: "Event",
        });
    });
