import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeNocRetriever = new Command("invoke-noc-retriever")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-noc-retriever-${stage}`,
            InvocationType: "Event",
        });
    });
