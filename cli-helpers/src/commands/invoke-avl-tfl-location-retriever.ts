import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeAvlTflLocationRetriever = new Command("invoke-avl-tfl-location-retriever")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-tfl-location-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
