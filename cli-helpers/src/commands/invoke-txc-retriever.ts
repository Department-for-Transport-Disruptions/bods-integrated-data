import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeTxcRetriever = new Command("invoke-txc-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-txc-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
