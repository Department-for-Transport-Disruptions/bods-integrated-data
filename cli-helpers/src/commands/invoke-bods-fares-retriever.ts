import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeBodsFaresRetriever = new Command("invoke-bods-fares-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-fares-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
