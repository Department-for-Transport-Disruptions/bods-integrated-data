import { ListClustersCommand, ListServicesCommand } from "@aws-sdk/client-ecs";
import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, withUserPrompts } from "../utils";
import { createEcsClient } from "../utils/awsClients";

export const getEcsClusterForService = new Command("get-ecs-cluster-for-service")
    .addOption(STAGE_OPTION)
    .option("-s, --service <service>", "Name of ECS service")
    .action(async (options) => {
        const { stage, service } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            service: { type: "input" },
        });

        const ecsClient = createEcsClient(stage);
        const clusters = await ecsClient.send(new ListClustersCommand());

        if (!clusters.clusterArns) {
            throw new Error("No Clusters found");
        }

        for (const cluster of clusters.clusterArns) {
            const services = await ecsClient.send(
                new ListServicesCommand({
                    cluster,
                }),
            );

            if (!services.serviceArns) {
                continue;
            }

            const serviceNames = services.serviceArns.map((s) => s.split("/").at(-1));

            if (serviceNames.includes(service)) {
                const clusterName = cluster.split("/").at(-1);

                if (clusterName) {
                    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
                    console.log(cluster.split("/").at(-1));
                }
            }
        }

        ecsClient.destroy();
    });
