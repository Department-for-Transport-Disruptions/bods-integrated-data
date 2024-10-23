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
                            name: `integrated-data-bods-disruptions-unzipped-${stage}`,
                        },
                        object: {
                            key: "disruptions/sirisx.xml",
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-disruptions-processor-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    })
    .parse();
