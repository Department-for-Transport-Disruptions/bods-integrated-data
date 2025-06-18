import { Option } from "@commander-js/extra-typings";
import { program } from "commander";
import { invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";

const migrationOptions = ["migrate", "rollback"];

program
    .addOption(STAGE_OPTION)
    .addOption(new Option("-m, --migrationType <migrationType>", "Migration type").choices(migrationOptions))
    .action(async (options) => {
        const { stage, migrationType } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            migrationType: { type: "list", choices: migrationOptions },
        });

        await invokeLambda(stage, {
            FunctionName: `integrated-data-db-migrator-${migrationType}-${stage}`,
            InvocationType: "RequestResponse",
        });
    })
    .parse();
