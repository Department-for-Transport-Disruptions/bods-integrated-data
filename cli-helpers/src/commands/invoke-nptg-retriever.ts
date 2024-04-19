import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("invoke-nptg-retriever").addOption(STAGE_OPTION).action(async (options) => {
    const { stage } = options;

    await invokeLambda(stage, {
        FunctionName: `integrated-data-nptg-retriever-${stage}`,
        InvocationType: "Event",
    });
});
