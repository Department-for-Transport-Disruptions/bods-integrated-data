import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeNaptanUploader = new Command("invoke-naptan-uploader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

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
    });
