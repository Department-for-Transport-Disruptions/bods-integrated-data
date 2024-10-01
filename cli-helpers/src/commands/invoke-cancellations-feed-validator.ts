import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeCancellationsFeedValidator = new Command("invoke-cancellations-feed-validator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        let { stage } = options;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: STAGES,
                },
            ]);

            stage = responses.stage;
        }

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-feed-validator-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
