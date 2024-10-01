import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeBodsFaresUnzipper = new Command("invoke-bods-fares-unzipper")
    .addOption(STAGE_OPTION)
    .option("-f, --file <file>", "File to unzip")
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
                            name: `integrated-data-bods-fares-zipped-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-fares-unzipper-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });
