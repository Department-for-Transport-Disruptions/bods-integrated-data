import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("invoke-noc-processor").addOption(STAGE_OPTION).action(async (options) => {
    const { stage } = options;

    const payload = {
        Records: [
            {
                s3: {
                    bucket: {
                        name: `integrated-data-noc-${stage}`,
                    },
                    object: {
                        key: "noc.xml",
                    },
                },
            },
        ],
    };

    await invokeLambda(stage, {
        FunctionName: `integrated-data-noc-processor-${stage}`,
        InvocationType: "Event",
        Payload: JSON.stringify(payload),
    });
});
