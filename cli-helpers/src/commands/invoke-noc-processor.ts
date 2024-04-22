import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeNocProcessor = new Command("invoke-noc-processor")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-noc-${stage}`,
                        },
                        object: {
                            key: "noc.xml",
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-noc-processor-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });
