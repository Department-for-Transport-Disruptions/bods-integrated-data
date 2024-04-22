import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeNptgUploader = new Command("invoke-nptg-uploader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-nptg-${stage}`,
                        },
                        object: {
                            key: "NPTG.xml",
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-nptg-uploader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });
