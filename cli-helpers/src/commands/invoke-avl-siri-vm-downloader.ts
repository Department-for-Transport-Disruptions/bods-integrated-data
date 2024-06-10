import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlSiriVmDownloader = new Command("invoke-avl-siri-vm-downloader")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("--downloadTfl <downloadTfl>", "Pass downloadTfl parameter to function")
    .option("--boundingBox <boundingBox>", "Pass boundingBox parameter to function")
    .option("--operatorRef <operatorRef>", "Pass operatorRef parameter to function")
    .option("--vehicleRef <vehicleRef>", "Pass vehicleRef parameter to function")
    .option("--lineRef <lineRef>", "Pass lineRef parameter to function")
    .option("--producerRef <producerRef>", "Pass producerRef parameter to function")
    .option("--originRef <originRef>", "Pass originRef parameter to function")
    .option("--destinationRef <destinationRef>", "Pass destinationRef parameter to function")
    .option("--subscriptionId <subscriptionId>", "Pass subscriptionId parameter to function")
    .action(async (options) => {
        const { stage, ...params } = options;

        const invokePayload = {
            queryStringParameters: params,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-siri-vm-downloader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
