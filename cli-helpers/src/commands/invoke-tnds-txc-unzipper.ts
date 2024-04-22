import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeTndsTxcUnzipper = new Command("invoke-tnds-txc-unzipper")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("-f, --file <file>", "File to unzip")
    .action(async (options) => {
        const { stage } = options;
        let { file } = options;

        if (!file) {
            const response = await inquirer.prompt<{ file: string }>([
                {
                    name: "file",
                    message: "Enter the file to unzip",
                    type: "input",
                },
            ]);

            file = response.file;
        }

        const payload = {
            Records: [
                {
                    s3: {
                        bucket: {
                            name: `integrated-data-tnds-txc-zipped-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-tnds-txc-unzipper-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });
