import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";

export const invokeAvlValidate = new Command("invoke-avl-validate")
    .addOption(STAGE_OPTION)
    .option("--url <url>", "Data producer url")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .action(async (options) => {
        const { stage, url, username, password } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            url: { type: "input" },
            username: { type: "input" },
            password: { type: "password" },
        });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"url\": \"${url}\",\"username\": \"${username}\",\"password\": \"${password}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-validate-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
