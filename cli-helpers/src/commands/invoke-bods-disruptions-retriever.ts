import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeBodsDisruptionsRetriever = new Command("invoke-bods-disruptions-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-disruptions-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
