import { regionCodes } from "@bods-integrated-data/shared/constants";
import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeGtfsTimetablesGenerator = new Command("invoke-gtfs-timetables-generator")
    .addOption(STAGE_OPTION)
    .option("-r, --region <region>", "Region to generate GTFS for")
    .action(async (options) => {
        const { stage, region } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            region: { type: "list", choices: regionCodes as unknown as string[] },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-timetables-generator-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({
                regionCode: region,
            }),
        });
    });
