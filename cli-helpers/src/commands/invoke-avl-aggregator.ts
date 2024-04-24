import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlAggregator = new Command("invoke-avl-aggregator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-aggregate-siri-vm-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
