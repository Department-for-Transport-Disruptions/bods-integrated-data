import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("invoke-db-migrator")
    .addOption(STAGE_OPTION)
    .option("-r, --rollback", "Perform a rollback")
    .action(async (options) => {
        const { stage, rollback } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-db-migrator-${rollback ? "rollback" : "migrate"}-${stage}`,
            InvocationType: "Event",
        });
    });
