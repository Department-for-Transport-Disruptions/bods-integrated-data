import { program } from "commander";
import { invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("--body <body>", "Request body")
    .action(async (options) => {
        const { stage, body } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            body: { type: "input" },
        });

        const invokePayload = {
            body,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-mock-data-receiver-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    })
    .parse();
