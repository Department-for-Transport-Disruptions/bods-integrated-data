import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

program
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
                            name: `integrated-data-naptan-stops-${stage}`,
                        },
                        object: {
                            key: "Stops.csv",
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-naptan-uploader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    })
    .parse();
