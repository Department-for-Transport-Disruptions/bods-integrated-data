import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeNocProcessor = new Command("invoke-noc-processor")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

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
