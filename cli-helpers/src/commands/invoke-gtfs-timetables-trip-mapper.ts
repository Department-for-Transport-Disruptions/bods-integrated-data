import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-timetables-trip-mapper-${stage}`,
            InvocationType: "RequestResponse",
        });
    })
    .parse();