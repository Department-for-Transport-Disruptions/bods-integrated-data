import { regionCodes } from "@bods-integrated-data/shared/constants";
import { program } from "commander";
import { invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";

program
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
    })
    .parse();
