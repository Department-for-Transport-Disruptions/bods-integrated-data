import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlTflLineIdRetriever = new Command("invoke-avl-tfl-line-id-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-tfl-line-id-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
