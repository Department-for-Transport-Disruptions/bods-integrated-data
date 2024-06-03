import { CloudWatchClient, MetricDatum, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isDocker = process.env.IS_DOCKER;

const cloudwatchClient = new CloudWatchClient({
    region: "eu-west-2",
    ...(process.env.STAGE === "local"
        ? {
              endpoint:
                  localStackHost || isDocker ? "http://bods_integrated_data_localstack:4566" : "http://localhost:4566",
              forcePathStyle: true,
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const putMetricData = async (namespace: string, metricData: MetricDatum[]) => {
    await cloudwatchClient.send(
        new PutMetricDataCommand({
            Namespace: namespace,
            MetricData: metricData,
        }),
    );
};
