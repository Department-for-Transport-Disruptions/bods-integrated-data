import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("invoke-noc-uploader").addOption(STAGE_OPTION).action(async (options) => {
    const { stage } = options;

    await invokeLambda(stage, {
        FunctionName: `integrated-data-noc-uploader-${stage}`,
        InvocationType: "Event",
    });
});
