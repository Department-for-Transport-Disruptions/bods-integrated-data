import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeCancellationsProcessor = new Command("invoke-cancellations-processor")
    .addOption(STAGE_OPTION)
    .option("-f, --file <file>", "File path")
    .action(async (options) => {
        const { stage, file } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            file: { type: "input" },
        });

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-cancellations-raw-siri-sx-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-processor-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });