import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlSiriVmStats = new Command("invoke-avl-siri-vm-stats")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `avl-siri-vm-stats-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
