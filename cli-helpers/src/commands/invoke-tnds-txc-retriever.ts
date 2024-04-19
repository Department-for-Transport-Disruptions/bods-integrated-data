import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("invoke-tnds-txc-retriever").addOption(STAGE_OPTION).action(async (options) => {
    const { stage } = options;

    await invokeLambda(stage, {
        FunctionName: `integrated-data-tnds-txc-retriever-${stage}`,
        InvocationType: "Event",
    });
});
