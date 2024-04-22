import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeTableRenamer = new Command("invoke-table-renamer")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-table-renamer-${stage}`,
            InvocationType: "Event",
        });
    });
