import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlRetriever = new Command("invoke-bods-avl-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-avl-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });