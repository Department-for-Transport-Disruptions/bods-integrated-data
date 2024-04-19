import { Command, Option } from "@commander-js/extra-typings";
import { DEFAULT_STAGE, STAGES, invokeLambda } from "../utils";

export default new Command("invoke-noc-retriever")
    .addOption(new Option("-s, --stage <stage>", "Stage to use").choices(STAGES).default(DEFAULT_STAGE))
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-noc-retriever-${stage}`,
            InvocationType: "Event",
        });
    });
