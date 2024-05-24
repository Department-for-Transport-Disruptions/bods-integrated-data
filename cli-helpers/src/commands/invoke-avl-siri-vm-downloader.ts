import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlSiriVmDownloader = new Command("invoke-avl-siri-vm-downloader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-siri-vm-downloader-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
