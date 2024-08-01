import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlDataFeedValidator = new Command("invoke-avl-data-feed-validator")
    .addOption(STAGE_OPTION)
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
            FunctionName: `integrated-data-avl-datafeed-validator-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
