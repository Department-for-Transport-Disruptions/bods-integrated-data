import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlProcessor = new Command("invoke-avl-processor")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-processor-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
