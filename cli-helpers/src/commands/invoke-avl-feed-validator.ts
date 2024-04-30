import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda, STAGES } from "../utils";

export const invokeAvlFeedValidator = new Command("invoke-avl-feed-validator")
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
            FunctionName: `integrated-data-avl-feed-validator-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
