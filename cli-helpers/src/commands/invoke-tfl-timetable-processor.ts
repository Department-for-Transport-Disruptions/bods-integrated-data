import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("-f, --file <file>", "File to process")
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
                            name: `integrated-data-tfl-timetable-${stage}`,
                        },
                        object: {
                            key: file,
                        },
                    },
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-tfl-timetable-processor-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    })
    .parse();
