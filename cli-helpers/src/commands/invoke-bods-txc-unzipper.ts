import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeBodsTxcUnzipper = new Command("invoke-bods-txc-unzipper")
    .addOption(STAGE_OPTION)
    .option("-d, --file <file>", "File to unzip")
    .action(async (options) => {
        const { stage, file } = options;

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-bods-txc-zipped-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-txc-unzipper-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(payload),
        });
    });
