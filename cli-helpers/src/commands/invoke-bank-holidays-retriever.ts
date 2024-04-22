import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeBankHolidaysRetriever = new Command("invoke-bank-holidays-retriever")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bank-holidays-retriever-${stage}`,
            InvocationType: "Event",
        });
    });
