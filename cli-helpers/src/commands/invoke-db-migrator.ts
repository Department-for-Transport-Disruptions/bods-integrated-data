import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeDbMigrator = new Command("invoke-db-migrator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("-r, --rollback", "Perform a rollback")
    .action(async (options) => {
        const { stage, rollback } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-db-migrator-${rollback ? "rollback" : "migrate"}-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
