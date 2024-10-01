import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeDbMigrator = new Command("invoke-db-migrator")
    .addOption(STAGE_OPTION)
    .option("-r, --rollback <rollback>", "Perform a rollback")
    .action(async (options) => {
        const { stage, rollback } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            rollback: { type: "checkbox" },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-db-migrator-${rollback ? "rollback" : "migrate"}-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
