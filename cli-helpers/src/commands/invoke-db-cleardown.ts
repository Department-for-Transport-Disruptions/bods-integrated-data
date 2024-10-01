import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeDbCleardown = new Command("invoke-db-cleardown").addOption(STAGE_OPTION).action(async (options) => {
    const { stage } = await withUserPrompts(options, {
        stage: { type: "list", choices: STAGES },
    });

    await invokeLambda(stage, {
        FunctionName: `integrated-data-db-cleardown-${stage}`,
        InvocationType: "RequestResponse",
    });
});
