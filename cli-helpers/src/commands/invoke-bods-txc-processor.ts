import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeBodsTxcProcessor = new Command("invoke-bods-txc-processor")
    .addOption(STAGE_OPTION)
    .option("-d, --file <file>", "File to process")
    .action(async (options) => {
        const { stage, file } = options;

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-bods-txc-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-txc-processor-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(payload),
        });
    });
