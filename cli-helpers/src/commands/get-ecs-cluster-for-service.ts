import { ECSClient, ListClustersCommand, ListServicesCommand } from "@aws-sdk/client-ecs";
import { Command } from "@commander-js/extra-typings";
import { withUserPrompts } from "../utils";

export const getEcsClusterForService = new Command("get-ecs-cluster-for-service")
    .option("-s, --service <service>", "Name of ECS service")
    .action(async (options) => {
        const { service } = await withUserPrompts(options, {
            service: { type: "input" },
        });

        const ecsClient = new ECSClient({ region: "eu-west-2" });

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
    });
