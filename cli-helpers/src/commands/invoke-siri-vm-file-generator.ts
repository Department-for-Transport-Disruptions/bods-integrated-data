import { program } from "commander";
import { invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-siri-vm-file-generator-${stage}`,
            InvocationType: "RequestResponse",
        });
    })
    .parse();
