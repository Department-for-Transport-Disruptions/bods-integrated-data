import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlTflLocationRetriever = new Command("invoke-avl-tfl-location-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-tfl-location-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
