import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";
program
    .addOption(STAGE_OPTION)
    .option("--download <download>", "Pass download parameter to function")
    .option("--routeId <routeId>", "Pass routeId parameter to function")
    .option("--startTimeBefore <startTimeBefore>", "Pass startTimeBefore parameter to function")
    .option("--startTimeAfter <startTimeAfter>", "Pass startTimeAfter parameter to function")
    .option("--boundingBox <boundingBox>", "Pass boundingBox parameter to function")
    .action(async (options) => {
        const { stage, download, routeId, startTimeBefore, startTimeAfter, boundingBox } = await withUserPrompts(
            options,
            {
                stage: { type: "list", choices: STAGES },
                download: { type: "input" },
                routeId: { type: "input" },
                startTimeBefore: { type: "input" },
                startTimeAfter: { type: "input" },
                boundingBox: { type: "input" },
            },
        );

        let invokePayload = {};

        if (download || routeId || startTimeBefore || startTimeAfter || boundingBox) {
            invokePayload = {
                queryStringParameters: {
                    download,
                    routeId,
                    startTimeBefore,
                    startTimeAfter,
                    boundingBox,
                },
            };
        }

        await invokeLambda(stage, {
            FunctionName: `integrated-data-gtfs-rt-downloader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    })
    .parse();
