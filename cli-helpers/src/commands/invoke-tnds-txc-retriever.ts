import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

// todo: get this working - FTP creds aren't being processed correctly yet
export const invokeTndsTxcRetriever = new Command("invoke-tnds-txc-retriever")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-tnds-txc-retriever-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
