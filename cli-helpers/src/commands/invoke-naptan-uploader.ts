import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeNaptanUploader = new Command("invoke-naptan-uploader")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = options;

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-naptan-${stage}`,
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
            InvocationType: "Event",
            Payload: JSON.stringify(payload),
        });
    });
