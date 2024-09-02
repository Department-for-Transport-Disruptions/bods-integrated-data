import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeBodsSiriVmAnalyser = new Command("invoke-bods-siri-vm-analyser")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-siri-vm-analyser-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
